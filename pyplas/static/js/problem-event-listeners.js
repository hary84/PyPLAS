// for /create/<p_id> or /problems/<p_id>
// global variable
//  kh          : from kernel.js
//  markdown    : from marked.js
//  hljs        : from highlight.js

document.addEventListener("DOMContentLoaded", async () => {
    const groups = window.location.pathname.match(/(?<parent_path>problems|create)\/(?<p_id>[-\w]+)/).groups
    const  p_id = groups.p_id
    const parent = groups.parent_path
    console.log(`problem_id(p_id) is '${p_id}'`)
    console.log(`parent path is '${parent}'`)
    document.querySelectorAll(".node.explain, .node.code").forEach(e => new EditorNode(e)) // ace editorの有効化
    document.querySelector("#headTitle").href = `/${parent}`
    // markdown.js, highlight.jsの準備
    if (parent == "problems") {
        document.querySelectorAll(".explain").forEach(elem => {
            elem.innerHTML = marked.parse(elem.innerHTML)
        })
    }else if (parent == "create") {
        document.querySelectorAll(".node.explain").forEach(e => new ExplainNode(e).showPreview())
    }
    hljs.highlightAll()

    // カーネルの起動, wsの接続
    await kh.setUpKernel()
    watchValue(kh, "running", setExecuteAnimation)
    watchValue(kh, "msg", renderMessage)

    // active node の監視
    const activeNode = {
        node_id: undefined,
        get() {return getNodeObjectByNodeId(this.node_id)}
    }
    watchValue(activeNode, "node_id", setActiveNodePointer)
    
    // ボタンイベントリスナー (左サイドバー)
    document.querySelector("#kernel-ops").addEventListener("click", async e => {
        const target = e.target.closest("a, button")
        if (!target) {return}
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
                    new CodeNode(e).resetState()
                })
            }
            // kernel interrupt ボタン ----- 実行中のコードを中断する
            else if (target.classList.contains("btn-interrupt")) {
                await kh.kernelInterrupt()
            } 
            // problem save ボタン ----- 解答の保存もしくは問題の登録をおこなう
            else if (target.classList.contains("btn-save")) {
                if (parent == "problems") {         // problemページの場合
                    await saveUserData(p_id)
                } else if (parent == "create") {    // createページの場合
                    await registerProblem(p_id)
                }
            }
        } catch(e) {
            errorHandling(e) // 例外処理
        } finally {
            target.classList.remove("disabled")
        }
    })

    // ボタンイベントリスナー (メイン)
    document.querySelector("main").addEventListener("click", async e => {
        const target = e.target.closest("a, button")
        if (!target) {return}
        const node = getNodeObjectByElem(e.target.closest(".node"))
        target.classList.add("disabled")
        try {
            // ============================== 
            //    その他
            // ============================== 
            if (target.classList.contains("btn-delme")) {
                node.delme()
            }
            else if (target.classList.contains("btn-addMD")) {
                e.stopPropagation()
                const explainNode = await addMD(target.closest(".node-control"), "afterend")
                activeNode.node_id = explainNode.nodeId
            } 
            else if (target.classList.contains("btn-addCode")) {
                e.stopPropagation()
                const codeNode = await addCode(target.closest(".node-control"), "afterend", {
                    user: Number(parent == "create")
                })
                activeNode.node_id = codeNode.nodeId
            } 
            else if (target.classList.contains("btn-addQ")) {
                const questionNode = await addQ(target.closest(".node-control"), "afterend", 
                            Number(target.dataset.ptype))
                activeNode.node_id = questionNode.nodeId
            }
            // ============================== 
            //    Code Node
            // ============================== 
            else if  (node instanceof CodeNode) {
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
            else if (node instanceof QuestionNode) {
                if (target.classList.contains("btn-testing")) { 
                    await node.scoring(p_id)
                } 
                else if (target.classList.contains("btn-cancel")) {
                    await node.canceling(p_id)
                } 
                else if (target.classList.contains("btn-load-ipynb")) {
                    const file = await filePicker()
                    const loc = node.element.querySelector(".answer-content")
                    if (!loc) {return}
                    await loadIpynb(file, loc, false, {
                        user: Number(parent=="create"),
                        inQ: true}
                    )
                }
                else if (target.classList.contains("btn-exec-all")) {
                    await kh.executeAll(node.element.querySelector(".answer-content"))
                }  

            }
            // ============================== 
            //    Explain Node
            // ============================== 
            else if (node instanceof ExplainNode) {
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
            errorHandling(e)
        }
        target.classList.remove("disabled")
    })

    // イベントリスナー (node, click)
    window.addEventListener("click", e => {
        const target = e.target.closest("main .node[node-id]")
        if (target) {
            activeNode.node_id = target.getAttribute("node-id")
        }
    })

    // イベントリスナー (Key down)
    window.addEventListener("keydown", async e => {
        // [BODY, TEXTAREA] Ctrl-Enter ----- コードの実行
        if (e.ctrlKey && e.key == "Enter") {
            const targetNode = activeNode.get()
            if (!targetNode) {return}
            // In Explain Node
            if (targetNode instanceof ExplainNode) {
                targetNode.showPreview()
            } 
            // In Code Node
            else if (targetNode instanceof CodeNode) {
                targetNode.editor.blur()
                kh.execute(targetNode.nodeId)
            }
            // in Question Node
            else if (targetNode instanceof QuestionNode) {
                if (parent == "problems") {
                    await targetNode.scoring(p_id)
                }
            }
        }
        // [BODY] Enter ----- エディターにフォーカス
        else if (e.key == "Enter" && e.target.tagName == "BODY") {
            e.preventDefault()
            const targetNode = activeNode.get()
            if (!targetNode) {return}
            // In Explain Node
            if (targetNode instanceof ExplainNode) {
                targetNode.showEditor()
                targetNode.editor.focus()
            }
            // In Code Node
            else if (targetNode instanceof CodeNode) {
                targetNode.editor.focus()
            }
            // In Question Node
            else if (targetNode instanceof QuestionNode) {
                const answerNodes = targetNode.answerNodes
                if (answerNodes.length == 0) {
                    const nodeControl = targetNode.element.querySelector(".answer-content .node-control")
                    if (nodeControl) {
                        const nextActiveNode = await addCode(nodeControl, "afterend", {
                            user: parent == "create"
                        })
                        activeNode.node_id = nextActiveNode.nodeId
                    }
                } else {
                    activeNode.node_id = answerNodes[0].nodeId
                }
            }
        }
        // [BODY] Escape ----- question node内部のnodeからquestion node自身へactive nodew切り替え
        else if (e.key == "Escape" && e.target.tagName == "BODY") {
            const targetNode = activeNode.get()
            if (targetNode) {
                const parentNode = targetNode.parentNode()
                activeNode.node_id = activeNode.node_id || parentNode.nodeId
            } 
        }
        // [TEXTAREA] Escape ----- エディターのフォーカスを解除
        else if (e.key == "Escape" && e.target.tagName == "TEXTAREA") {
            const targetNode = new EditorNode(e.target.closest(".node"))
            targetNode.editor.blur()
        }
        // [else] Escape ----- focusを解除
        else if (e.key == "Escape" && !["BODY", "TEXTAREA"].includes(e.target.tagName)) {
            e.target.blur()
        }
        // [BODY] Ctrl-S ----- 解答の保存もしくは問題の登録
        else if (e.ctrlKey && e.key == "s" && e.target.tagName == "BODY") {
            e.preventDefault()
            if (parent == "problems") {
                saveUserData(p_id)
            } else if (parent == "create") {
                registerProblem(p_id)
            }
        }
        // [BODY] j or k ----- active node の移動
        else if ((e.key == "j" || e.key == "k") && e.target.tagName == "BODY") {
            const currentActiveNode = activeNode.get()
            const nextActiveNode = (e.key == "j") ? 
                    currentActiveNode.nextNode() : currentActiveNode.prevNode()
            if (nextActiveNode) {
                activeNode.node_id = nextActiveNode.nodeId
                const {top, bottom} = nextActiveNode.element.getBoundingClientRect()
                if (top < 0 || bottom > window.innerHeight) {
                    nextActiveNode.element.scrollIntoView({"behavior": "instant", "block": "center"})
                }
            }
        }
        // [BODY] Ctrl-l ----- active nodeを画面中央に寄せる
        else if (e.ctrlKey && e.key == "l" & e.target.tagName == "BODY") {
            e.preventDefault()
            const currentActiveNode = BaseNode.getNodeElementByNodeId(activeNode.node_id)
            currentActiveNode.scrollIntoView({"behavior": "instant", "block": "center"})
        }
        // [BODY] b or a ----- 下/上にCode Nodeを追加
        else if ((e.key == "b" || e.key == "a") && e.target.tagName == "BODY") {
            const currentActiveNode = activeNode.get()
            if (!currentActiveNode) {return}
            const nodeCotnrol = (e.key == "b") ? 
                    currentActiveNode.element.nextElementSibling : currentActiveNode.element.previousElementSibling
            if (nodeCotnrol.classList.contains("node-control")) {
                await addCode(nodeCotnrol, "afterend", {
                    user: Number(parent == "create")
                })
            }
        }
        // [BODY] d ----- active nodeを削除
        else if (e.key == "d" && e.target.tagName == "BODY") {
            const currentActiveNode = activeNode.get()
            if (!currentActiveNode) {return}
            if (currentActiveNode.allowDelete()) {
                let nextNode = 
                    currentActiveNode.nextNode()
                    || currentActiveNode.prevNode()
                    || currentActiveNode.parentNode()
                currentActiveNode.delme()
                if (nextNode) {
                    activeNode.node_id = nextNode.nodeId
                }
            }            
        }
    })
    // イベントリスナー (dblclick)
    window.addEventListener("dblclick", e => {
        const target = getNodeObjectByElem(e.target.closest(".node.explain"))
        if (!target) { return }
        target.showEditor()
    })
})


/**
 * KernelHandler classのrunningパラメータが変化した際に起動する関数
 * @param {KernelHandler} kh 
 * @param {boolean} oldValue
 * @param {boolean} newValue 
 */
function setExecuteAnimation(kh, oldValue, newValue) {
    // コード実行中(kh.running == true)の時
    if (newValue) {
        const runningNode = BaseNode.getNodeElementByNodeId(kh.execute_task_q[0])
        runningNode.setAttribute("run-state", "running")
        runningNode.querySelector(".node-side").classList.add("bg-success-subtle")
        kh.execute_task_q.slice(1, ).forEach(id => {
            BaseNode.getNodeElementByNodeId(id).setAttribute("run-state", "suspending")
        })
    // 非コード実行中(kh.running == false)の時
    } else {
        document.querySelectorAll(".code").forEach(elem => {
            elem.setAttribute("run-state", "idle")
        })
    }
}
/**
 * KernelHandlerがwsでメッセージを受信した際の処理を行う関数
 * @param {KernelHandler} kh 
 * @param {Object} oldValue 
 * @param {Object} newValue 
 */
function renderMessage(kh, oldValue, newValue) {
    if (newValue) {
        const content = newValue.content
        const return_form = BaseNode.getNodeElementByNodeId(newValue.node_id).querySelector(".return-box")
        // console.log(newValue.msg_type)
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
    }
}
function renderResult(res, form, type="text") {
    switch (type) {
        case "text":
            var res = escapeHTML(res)
            form.insertAdjacentHTML("beforeend", `<p class="exec-res">${res}</p>`)
            break;
        case "img":
            form.insertAdjacentHTML("beforeend",`<img class="exec-res ms-2" src="data:image/png;base64,${res}" style="max-width: 95%;"/>`)
            break;
        case "error":
            var res = escapeHTML(res, true).replace(/\n/g, "<br>")
            form.insertAdjacentHTML("beforeend", `<p class="text-danger exec-res">${res}</p>`)
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
    const oldNode = getNodeObjectByNodeId(oldNodeId)
    const newNode = getNodeObjectByNodeId(newNodeId)
    if (oldNode) {oldNode.element.classList.remove("active-node")}
    if (newNode) {newNode.element.classList.add("active-node")}
}