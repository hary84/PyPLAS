// for /create/<p_id> or /problems/<p_id>
// global variable
//  kh          : from kernel.js
//  markdown    : from marked.js
//  hljs        : from highlight.js

document.addEventListener("DOMContentLoaded", async () => {
    const groups = window.location.pathname.match(/(?<parent_path>problems|create)\/(?<p_id>[-\w]+)/).groups
    const  p_id = groups.p_id
    const parent = groups.parent_path
    console.log(`problem_id(p_id) is ${p_id}`)
    console.log(`parent path is ${parent}`)
    document.querySelectorAll(".node-mde").forEach(elem => registerAceMDE(elem))     // AceMDEの登録
    document.querySelectorAll(".node-code").forEach(elem => registerAceEditor(elem)) // AceEditorの登録
    document.querySelectorAll(".node.question").forEach(elem => elem.setAttribute("node-id", crypto.randomUUID()))
    document.querySelector("#headTitle").href = `/${parent}`
    // markdown.js, highlight.jsの準備
    if (parent == "problems") {
        document.querySelectorAll(".explain").forEach(elem => {
            elem.innerHTML = marked.parse(elem.innerHTML)
        })
    }else if (parent == "create") {
        document.querySelectorAll(".node-mde").forEach(elem => showPreview(elem))
    }
    hljs.highlightAll()

    // カーネルの起動, wsの接続
    await kh.setUpKernel()
    watchValue(kh, "running", setExecuteAnimation)
    watchValue(kh, "msg", renderMessage)

    // active node の監視
    const activeNode = {node_id: undefined}
    watchValue(activeNode, "node_id", setActiveNodePointer)
    try{ 
        activeNode.node_id = document.querySelector("#sourceCode .node[node-id]").getAttribute("node-id")
    } catch {}

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
                document.querySelectorAll(".node.code").forEach(elem => {
                    elem.querySelector(".return-box").innerHTML = ""
                    elem.querySelector(".node-side").classList.remove("bg-success-subtle")
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
    document.querySelector("#sourceCode").addEventListener("click", async e => {
        const target = e.target.closest("a, button")
        if (!target) {return}
        target.classList.add("disabled")
        try {
            // [node] execute ボタン ----- 対象ノードのコードを実行する
            if (target.classList.contains("btn-exec")) { 
                const node_id = target.closest(".node.code").getAttribute("node-id")
                await kh.execute(node_id)
            } 
            // [node] interrupt ボタン ----- コードの実行を中断する
            else if (target.classList.contains("btn-interrupt")) {
                await kh.kernelInterrupt()
            } 
            // [question] answer ボタン ----- ユーザーの解答を採点する
            else if (target.classList.contains("btn-testing")) { 
                const questionParams = extractQuestionNode(target, mode=0)
                if (!questionParams) {return}
                await scoring(p_id, questionParams.q_id, questionParams.node_id)
            } 
            // [question] cancel ボタン ----- 採点を中断する
            else if (target.classList.contains("btn-cancel")) {
                const questionParams = extractQuestionNode(target, mode=0)
                if (!questionParams) {return}
                await cancelScoring(p_id, questionParams.node_id)
            } 
            // [question] load-ipynb ボタン ----- jupyter notebookを読み込む
            else if (target.classList.contains("btn-load-ipynb")) {
                const file = await filePicker()
                const loc = target.closest(".question.node").querySelector(".answer-content")
                if (!loc) {return}
                await loadIpynb(file, loc, false, {
                    user: Number(parent=="create"),
                    inQ: true}
                )
            }
            // [question] exec-all ボタン ----- question node内のすべてのコードを実行する
            else if (target.classList.contains("btn-exec-all")) {
                await kh.executeAll(target.closest(".card-body").querySelector(".answer-content"))
            }  
            // [node-control] add MD ボタン ---- Explain Nodeを追加する
            else if (target.classList.contains("btn-addMD")) {
                e.stopPropagation()
                const ExplainNode = await addMD(target.closest(".node-control"), "afterend")
                activeNode.node_id = ExplainNode.getAttribute("node-id")
            } 
            // [node-control] add Code ボタン ----- Code Nodeを追加する
            else if (target.classList.contains("btn-addCode")) {
                e.stopPropagation()
                const codeNode = await addCode(target.closest(".node-control"), "afterend", {
                    user: Number(parent == "create")
                })
                activeNode.node_id = codeNode.getAttribute("node-id")
            } 
            // [node-control] add Question ボタン ----- Question Nodeを追加する
            else if (target.classList.contains("btn-addQ")) {
                const questionNode = await addQ(target.closest(".node-control"), "afterend", 
                            Number(target.dataset.ptype))
                activeNode.node_id = questionNode.getAttribute("node-id")
            }
        }
        catch (e) {
            errorHandling(e)
        }
        target.classList.remove("disabled")
    })

    // イベントリスナー (node, click)
    window.addEventListener("click", e => {
        const target = e.target.closest("#sourceCode .node[node-id]")
        if (target) {
            activeNode.node_id = target.getAttribute("node-id")
        }
    })

    // イベントリスナー (Key down)
    window.addEventListener("keydown", async e => {
        // [BODY, TEXTAREA] Ctrl-Enter ----- コードの実行
        if (e.ctrlKey && e.key == "Enter") {
            const targetNode = (e.target.tagName == "TEXTAREA")
                     ? e.target.closest(".node[node-id]") : getNodeElement(activeNode.node_id)
            if (!targetNode) {return}
            // In Explain Node
            if (targetNode.classList.contains("explain")) {
                showPreview(targetNode.querySelector(".mde"))
            } 
            // In Code Node
            else if (targetNode.classList.contains("code")) {
                ace.edit(targetNode.querySelector(".node-code")).blur()
                kh.execute(targetNode.getAttribute("node-id"))
            }
            // in Question Node
            else if (targetNode.classList.contains("question")) {
                if (parent == "problems") {
                    const questionParams = extractQuestionNode(targetNode, 0)
                    if (!questionParams) {return}
                    await scoring(p_id, questionParams.q_id, questionParams.node_id)
                }
            }
        }
        // [BODY] Enter ----- エディターにフォーカス
        else if (e.key == "Enter" && e.target.tagName == "BODY") {
            e.preventDefault()
            const targetNode = getNodeElement(activeNode.node_id)
            if (!targetNode) {return}
            // In Explain Node
            if (targetNode.classList.contains("explain")) {
                const editElem = targetNode.querySelector(".node-mde")
                showEditor(editElem)
                ace.edit(editElem).focus()
            }
            // In Code Node
            else if (targetNode.classList.contains("code")) {
                ace.edit(targetNode.querySelector(".node-code")).focus()
            }
            // In Question Node
            else if (targetNode.classList.contains("question")) {
                let firstAnswerCode = targetNode.querySelector(".answer-content .node.code[node-id]")
                if (!firstAnswerCode) {
                    const nodeControl = targetNode.querySelector(".node-control")
                    if (nodeControl) {
                        firstAnswerCode = await addCode(nodeControl, "afterend", {
                            user: parent == "create"
                        })
                    }
                }
                activeNode.node_id = firstAnswerCode.getAttribute("node-id")
            }
        }
        // [BODY] Escape ----- question node内部のnodeからquestion node自身へactive nodew切り替え
        else if (e.key == "Escape" && e.target.tagName == "BODY") {
            const targetQuestionNode = getNodeElement(activeNode.node_id).closest(".question.node[node-id]")
            if (!targetQuestionNode) {return} 
            activeNode.node_id = targetQuestionNode.getAttribute("node-id")
        }
        // [TEXTAREA] Escape ----- エディターのフォーカスを解除
        else if (e.key == "Escape" && e.target.tagName == "TEXTAREA") {
            const targetNode = e.target.closest(".node[node-id]")
            if (!targetNode) {return}
            const editor = ace.edit(targetNode.querySelector(".node-code, .node-mde"))
            editor.blur()
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
            const currentActiveNode = getNodeElement(activeNode.node_id)
            if (!currentActiveNode) {return}
            const nextActiveNode = (e.key == "j") ? 
                    getNextElement(currentActiveNode, "node-id") : getPrevElement(currentActiveNode, "node-id")
            if (nextActiveNode) {
                activeNode.node_id = nextActiveNode.getAttribute("node-id")
                const {top, bottom} = nextActiveNode.getBoundingClientRect()
                if (top < 0 || bottom > window.innerHeight) {
                    nextActiveNode.scrollIntoView({"behavior": "instant", "block": "center"})
                }
            }
        }
        else if (e.ctrlKey && e.key == "l" & e.target.tagName == "BODY") {
            e.preventDefault()
            const currentActiveNode = getNodeElement(activeNode.node_id)
            currentActiveNode.scrollIntoView({"behavior": "instant", "block": "center"})
        }
        // [BODY] b or a ----- 下/上にCode Nodeを追加
        else if ((e.key == "b" || e.key == "a") && e.target.tagName == "BODY") {
            const currentActiveNode = getNodeElement(activeNode.node_id)
            if (!currentActiveNode) {return}
            const nodeCotnrol = (e.key == "b") ? 
                    currentActiveNode.nextElementSibling : currentActiveNode.previousElementSibling
            if (nodeCotnrol.classList.contains("node-control")) {
                await addCode(nodeCotnrol, "afterend", {
                    user: Number(parent == "create")
                })
            }
        }
        // [BODY] d ----- active nodeを削除
        else if (e.key == "d" && e.target.tagName == "BODY") {
            const currentActiveNode = getNodeElement(activeNode.node_id)
            if (!currentActiveNode) {return}
            const delbtn = currentActiveNode.querySelector(".btn-delme")
            if (delbtn) {
                let nextNode = 
                    getNextElement(currentActiveNode, "node-id") 
                    || getPrevElement(currentActiveNode, "node-id")
                    || currentActiveNode.closest(".question.node[node-id]")
                delme(delbtn)
                if (nextNode) {
                    activeNode.node_id = nextNode.getAttribute("node-id")
                }
            }            
        }
    })
    // イベントリスナー (dblclick)
    window.addEventListener("dblclick", e => {
        const target = e.target.closest(".for-preview")
        if (!target) { return }
        showEditor(target)
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
        const runningNode = getNodeElement(kh.execute_task_q[0])
        runningNode.setAttribute("run-state", "running")
        runningNode.querySelector(".node-side").classList.add("bg-success-subtle")
        kh.execute_task_q.slice(1, ).forEach(id => {
            getNodeElement(id).setAttribute("run-state", "suspending")
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
        const return_form = getNodeElement(newValue.node_id).querySelector(".return-box")
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
    const oldNode = getNodeElement(oldNodeId)
    const newNode = getNodeElement(newNodeId)
    if (oldNode) {oldNode.classList.remove("active-node")}
    if (newNode) {newNode.classList.add("active-node")}
}