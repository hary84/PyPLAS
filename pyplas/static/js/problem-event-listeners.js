//@ts-check
// for /create/<p_id> or /problems/<p_id>
///<reference path="./modules/create-utils.js"/>

import { myNode } from "./modules/myclass.js"
import * as myclass from "./modules/myclass.js"
import {p_id, parentRoute} from "./modules/utils.js"
import * as utils from "./modules/utils.js"
import kh from "./modules/kernel.js"
import reseter from "./modules/reset-manager.js"

// document.addEventListener("DOMContentLoaded", async () => {
    document.querySelectorAll(".node.explain, .node.code").forEach(e => myNode.get(e))// ace editorの有効化
    document.querySelector("#headTitle").href = `/${parentRoute}`
    // markdown.js, highlight.jsの準備
    if (parentRoute == "problems") {
        document.querySelectorAll(".explain").forEach(elem => {
            elem.innerHTML = marked.parse(elem.innerHTML)
        })
    }else if (parentRoute == "create") {
        document.querySelectorAll(".node.explain").forEach(e => 
            myNode.explain(e).showPreview()
        )
    }
    hljs.highlightAll()

    // カーネルの起動, wsの接続
    await kh.setUpKernel()
    utils.watchValue(kh, "running", setExecuteAnimation)
    utils.watchValue(kh, "msg", renderMessage)

    // active node の監視
    utils.watchValue(myNode.activeNode, "node_id", setActiveNodePointer)
    
    // ボタンイベントリスナー (左サイドバー)
    document.querySelector("#kernel-ops").addEventListener("click", async e => {
        const target = e.target.closest("a, button")
        if (target === null) {return}
        target.classList.add("disabled")
        try {
            // execute all ボタン ----- すべてのCode Nodeを実行する
            if (target.classList.contains("btn-exec-all")) {
                await kh.executeAll(document.querySelector("#nodesContainer"))
            }
            // kernel restart ボタン ----- kernelを再起動する
            else if (target.classList.contains("btn-restart")) {
                await kh.setUpKernel(true)
                document.querySelectorAll(".node.code").forEach(e => {
                    myNode.code(e).resetState()
                })
            }
            // kernel interrupt ボタン ----- 実行中のコードを中断する
            else if (target.classList.contains("btn-interrupt")) {
                await kh.kernelInterrupt()
            } 
            // problem save ボタン ----- 解答の保存もしくは問題の登録をおこなう
            else if (target.classList.contains("btn-save")) {
                if (parentRoute == "problems") {         // problemページの場合
                    await utils.saveUserData()
                } else if (parentRoute == "create") {    // createページの場合
                    await registerProblem()
                }
            }
        } catch(e) {
            console.error(e)
        } finally {
            target.classList.remove("disabled")
        }
    })

    // ボタンイベントリスナー (メイン)
    document.querySelector("main").addEventListener("click", async e => {
        const target = e.target.closest("a, button")
        if (!target) {return}
        const node = myNode.get(e.target.closest(".node"))
        target.classList.add("disabled")
        try {
            // ============================== 
            //    一般
            // ============================== 
            if (node && target.classList.contains("btn-delme")) {
                node.delme()
            }
            else if (node && target.classList.contains("btn-reset-input")) {
                reseter.resetNode(node)
            }
            else if (target.classList.contains("btn-addMD")) {
                e.stopPropagation()
                const explainNode = await utils.addMD(target.closest(".node-control"), "afterend")
                myNode.activeNode.node_id = explainNode.nodeId
            } 
            else if (target.classList.contains("btn-addCode")) {
                e.stopPropagation()
                const codeNode = await utils.addCode(target.closest(".node-control"), "afterend", {
                    user: Number(parentRoute == "create")
                })
                myNode.activeNode.node_id = codeNode.nodeId
            } 
            else if (target.classList.contains("btn-addQ")) {
                const questionNode = await utils.addQ(target.closest(".node-control"), "afterend", 
                            Number(target.dataset.ptype))
                myNode.activeNode.node_id = questionNode.nodeId
            }
            // ============================== 
            //    Code Node
            // ============================== 
            else if  (node instanceof myclass.CodeNode) {
                if (target.classList.contains("btn-exec")) { 
                    await kh.execute(node.nodeId)
                } 
                else if (target.classList.contains("btn-interrupt")) {
                    await kh.kernelInterrupt()
                } 
            }
            // ============================== 
            //    Question Node
            // ============================== 
            else if (node instanceof myclass.QuestionNode) {
                if (target.classList.contains("btn-testing")) { 
                    await node.scoring()
                } 
                else if (target.classList.contains("btn-cancel")) {
                    await node.canceling()
                } 
                else if (target.classList.contains("btn-load-ipynb")) {
                    const file = await utils.filePicker()
                    const loc = node.element.querySelector(".answer-content")
                    if (!loc) {return}
                    await utils.loadIpynb(file, loc, false, {
                        user: Number(parentRoute=="create")}
                    )
                }
                else if (target.classList.contains("btn-exec-all")) {
                    await kh.executeAll(node.element.querySelector(".answer-content"))
                }  
            }
            // ============================== 
            //    Explain Node
            // ============================== 
            else if (node instanceof myclass.ExplainNode) {
                if (target.classList.contains("btn-bold")) {
                    node.embedBold()
                }
                else if (target.classList.contains("btn-italic")) {
                    node.embedItalic()
                }
                else if (target.classList.contains("btn-href")) {
                    node.embedLink()
                }
                else if (target.classList.contains("btn-img")) {
                    node.embedImg()
                }
                else if (target.classList.contains("btn-fib-p")) {{
                    node.addFillInBlankProblem()
                }}
                else if (target.classList.contains("btn-sellect-p")) {
                    node.addSelectionProblem()
                }
                else if (target.classList.contains("btn-preview")) {
                    node.showPreview()
                }
            }
        }
        catch (e) {
            console.error(e)
        }
        target.classList.remove("disabled")
    })

    // イベントリスナー (node, click)
    window.addEventListener("click", e => {
        const target = myNode.get(e.target.closest(".node"))
        if (target) {
            myNode.activeNode.node_id = target.nodeId
        }
    })

    // イベントリスナー (Key down)
    window.addEventListener("keydown", async e => {
        const currentActiveNode = myNode.activeNode.get()
        // ============================== 
        //    Ctrl + Enter
        // ============================== 
        if (e.ctrlKey && e.key == "Enter") {
            if (currentActiveNode instanceof myclass.ExplainNode) {
                currentActiveNode.showPreview()
            } 
            else if (currentActiveNode instanceof myclass.CodeNode) {
                currentActiveNode.editor.blur()
                kh.execute(currentActiveNode.nodeId)
            }
            else if (currentActiveNode instanceof myclass.QuestionNode) {
                if (parentRoute == "problems") {
                    await currentActiveNode.scoring()
                }
            }
        }
        // ============================== 
        //    Enter
        // ============================== 
        else if (e.key == "Enter" && e.target.tagName == "BODY") {
            e.preventDefault()
            if (currentActiveNode instanceof myclass.ExplainNode) {
                currentActiveNode.showEditor()
                currentActiveNode.editor.focus()
            }
            else if (currentActiveNode instanceof myclass.CodeNode) {
                currentActiveNode.editor.focus()
            }
            else if (currentActiveNode instanceof myclass.QuestionNode) {
                const answerNodes = currentActiveNode.childNodes
                if (answerNodes.length == 0) {
                    const nodeControl = currentActiveNode.element.querySelector(".answer-content .node-control")
                    if (nodeControl) {
                        const nextActiveNode = await utils.addCode(nodeControl, "afterend", {
                            user: Number(parentRoute == "create")
                        })
                        myNode.activeNode.node_id = nextActiveNode.nodeId
                    }
                } 
                else {
                    myNode.activeNode.node_id = answerNodes[0].nodeId
                }
            }
        }
        // ============================== 
        //    Escape in BODY
        // ============================== 
        else if (e.key == "Escape" && e.target.tagName == "BODY") {
            try {
                if (currentActiveNode instanceof myclass.EditorNode) {
                    const e = currentActiveNode.parentQuestionNode
                    myNode.activeNode.node_id = e.nodeId
                }
            } catch {}
        }
        // [TEXTAREA] Escape ----- エディターのフォーカスを解除
        else if (e.key == "Escape" && e.target.tagName == "TEXTAREA") {
            const targetNode = myNode.get(e.target.closest(".node"))
            targetNode.editor.blur()
        }
        // [else] Escape ----- focusを解除
        else if (e.key == "Escape" && !["BODY", "TEXTAREA"].includes(e.target.tagName)) {
            e.target.blur()
        }
        // [BODY] Ctrl-S ----- 解答の保存もしくは問題の登録
        else if (e.ctrlKey && e.key == "s" && e.target.tagName == "BODY") {
            e.preventDefault()
            if (parentRoute == "problems") {
                utils.saveUserData()
            } else if (parentRoute == "create") {
                registerProblem()
            }
        }
        // [BODY] j or k ----- active node の移動
        else if ((e.key == "j" || e.key == "k") && e.target.tagName == "BODY") {
            if (!currentActiveNode) {return}
            const nextActiveNode = (e.key == "j") ? 
                myNode.nextNode(currentActiveNode) : myNode.prevNode(currentActiveNode)
            if (nextActiveNode) {
                myNode.activeNode.node_id = nextActiveNode.nodeId
                const {top, bottom} = nextActiveNode.element.getBoundingClientRect()
                if (top < 0 || bottom > window.innerHeight) {
                    nextActiveNode.element.scrollIntoView({"behavior": "instant", "block": "center"})
                }
            }
        }
        // [BODY] Ctrl-l ----- active nodeを画面中央に寄せる
        else if (e.ctrlKey && e.key == "l" && e.target.tagName == "BODY") {
            e.preventDefault()
            if (currentActiveNode) {
                currentActiveNode.element.scrollIntoView({"behavior": "instant", "block": "center"})
            }
        }
        // [BODY] b or a ----- 下/上にCode Nodeを追加
        else if ((e.key == "b" || e.key == "a") && e.target.tagName == "BODY") {
            if (!currentActiveNode) {return}
            const nodeCotnrol = (e.key == "b") ? 
                    currentActiveNode.element.nextElementSibling : currentActiveNode.element.previousElementSibling
            if (nodeCotnrol.classList.contains("node-control")) {
                await addCode(nodeCotnrol, "afterend", {
                    user: Number(parentRoute == "create")
                })
            }
        }
        // [BODY] d ----- active nodeを削除
        else if (e.key == "d" && e.target.tagName == "BODY") {
            if (!currentActiveNode) {return}
            console.log(currentActiveNode.allowDelete())
            try {
                if (currentActiveNode.allowDelete()) {
                    let nextNode = 
                        myNode.nextNode(currentActiveNode)
                        || myNode.prevNode(currentActiveNode)
                        || currentActiveNode.parentQuestionNode
                    console.log(nextNode)
                    currentActiveNode.delme()
                    myNode.activeNode.node_id = nextNode.nodeId
                }
            } catch (e) {
                console.error(e)
            }
                  
        }
    })
    // イベントリスナー (dblclick)
    window.addEventListener("dblclick", e => {
        const target = myNode.explain(e.target.closest(".node.explain"))
        console.log(target)
        target.showEditor()
    })
// })


/**
 * KernelHandler classのrunningパラメータが変化した際に起動する関数
 * @param {boolean} oldValue
 * @param {boolean} newValue 
 */
function setExecuteAnimation(kh, oldValue, newValue) {
    // コード実行中(kh.running == true)の時
    if (newValue) {
        try {
            const runningNode = myNode.code(kh.execute_task_q[0])
            runningNode.element.setAttribute("run-state", "running")
            runningNode.element.querySelector(".node-side").classList.add("bg-success-subtle")
            kh.execute_task_q.slice(1, ).forEach(id => {
                myNode.code(id).element.setAttribute("run-state", "suspending")
            })
        } catch(e) {
            if (e instanceof myclass.NodeError) {}
            else {console.error(e)}
        }
    // 非コード実行中(kh.running == false)の時
    } else {
        document.querySelectorAll(".code").forEach(elem => {
            elem.setAttribute("run-state", "idle")
        })
    }
}
/**
 * KernelHandlerがwsでメッセージを受信した際の処理を行う関数
 * @param {Object} oldValue 
 * @param {Object} newValue 
 */
function renderMessage(kh, oldValue, newValue) {
    if (newValue) {
        try {
            const content = newValue.content
            const return_form = myNode.code(newValue.node_id).element.querySelector(".return-box")
            switch (newValue.msg_type) {
                case "execute_result":
                    renderResult(content["data"]["text/plain"], return_form)
                    break;
                case "stream":
                    renderResult(content["text"], return_form)
                    break;
                case "display_data":
                    renderResult(content["data"]["text/plain"], return_form)
                    renderResult(content["data"]["image/png"], return_form, "img")
                    break;
                case "error":
                    var error_msg = content["traceback"].join("\n")
                    renderResult(error_msg, return_form, "error")
                    break;
            }
        } catch (e) {
            if (e instanceof myclass.NodeError) {}
            else (console.error(e))
        }
    }
}
function renderResult(res, form, type="text") {
    switch (type) {
        case "text":
            const escapedt = utils.escapeHTML(res)
            form.insertAdjacentHTML("beforeend", `<p class="exec-res">${escapedt}</p>`)
            break;
        case "img":
            form.insertAdjacentHTML("beforeend",`<img class="exec-res ms-2" src="data:image/png;base64,${res}" style="max-width: 95%;"/>`)
            break;
        case "error":
            const escapede = utils.escapeHTML(res, true).replace(/\n/g, "<br>")
            form.insertAdjacentHTML("beforeend", `<p class="text-danger exec-res">${escapede}</p>`)
            break;
        default:
            throw new Error('"type" argument can be one of "text", "img", or "error".')
    }
}
/**
 * activeNodeがnode_idを変更した際の処理を行う関数
 * @param {Object} activeNode 
 * @param {String} oldNodeId 
 * @param {String} newNodeId 
 */
function setActiveNodePointer(activeNode, oldNodeId, newNodeId) {
    const oldNode = myNode.get(oldNodeId)
    const newNode = myNode.get(newNodeId)
    if (oldNode) {oldNode.element.classList.remove("active-node")}
    if (newNode) {newNode.element.classList.add("active-node")}
}