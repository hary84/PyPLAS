// for /create/<p_id> or /problems/<p_id>
//@ts-check
import { myNode } from "./modules/myclass.js"
import * as myclass from "./modules/myclass.js"
import * as utils from "./modules/utils.js"
import * as helper from "./modules/helper.js"
import kh from "./modules/kernel.js"
import reseter from "./modules/reset-manager.js"
import * as error from "./modules/error.js"


document.querySelectorAll(".node.explain, .node.code").forEach(e => myNode.get(e))// ace editorの有効化

// markdown.js, highlight.jsの準備
if (!helper.isCreateMode()) {
    document.querySelectorAll(".explain").forEach(elem => {
        elem.innerHTML = marked.parse(helper.unescapeHTML(elem.innerHTML))
    })
} else {
    document.querySelectorAll(".node.explain").forEach(e => 
        new myclass.ExplainNode(e).showPreview()
    )
}
hljs.highlightAll();

// start kernel and observe websocket
await kh.setUpKernel()
helper.watchValue(kh, "running", setExecuteAnimation)
helper.watchValue(kh, "msg", renderMessage)

// observe 'active node'
helper.watchValue(myNode.activeNode, "node_id", setActiveNodePointer)

// left side bar button 
document.querySelector("#kernel-ops")?.addEventListener("click", async e => {
    const target = e.target?.closest("a")
    if (target === null) {return}
    const action = target.dataset.action
    target.classList.add("disabled")
    try {
        switch (action) {
            case "exec-all":
                const nodesContainer = document.querySelector("#nodesContainer")
                if (nodesContainer == null) {throw new Error()}
                await kh.executeAll(nodesContainer)
                break;
            case "restart-kernel":
                await kh.setUpKernel(true)
                document.querySelectorAll(".node.code").forEach(e => {
                    new myclass.CodeNode(e).resetState()
                })
                break;
            case "interrupt-kernel":
                await kh.kernelInterrupt()
                break;
            case "save":
                if (!helper.isCreateMode()) {
                    await utils.saveUserData()
                } else {
                    await utils.registerProblem()
                }
                break;
        }
    } catch(e) {
        if (e instanceof error.ApplicationError) {
            alert(e.message)
            console.error(e)
        }
        else {
            alert("Unexpected error")
            console.error(e)
        }
    } finally {
        target.classList.remove("disabled")
    }
})

document.querySelector("main")?.addEventListener("click", e => {
    try {
        const node = myNode.get(e.target?.closest(".node") ?? myclass.emptyNodeId)
        if (node != null) {
            myNode.activeNode.node_id = node.nodeId
        }
    } catch {}
})

// main
document.querySelector("main")?.addEventListener("click", async e => {
    const target = e.target?.closest("a, button")
    if (!target) {return}
    const action = target.dataset.action
    target.classList.add("disabled")
    try {
        const node = myNode.get(e.target.closest(".node") ?? myclass.emptyNodeId)
        switch (action) {
            case "add-MD":
                e.stopPropagation()
                const explainNode = await utils.addMD(target.closest(".node-control"), "afterend")
                myNode.activeNode.node_id = explainNode.nodeId
                return
            case "add-Code":
                e.stopPropagation()
                const codeNode = await utils.addCode(target.closest(".node-control"), "afterend", {
                    user: Number(helper.isCreateMode())
                })
                myNode.activeNode.node_id = codeNode.nodeId
                return
            case "add-Question":
                e.stopPropagation()
                const questionNode = await utils.addQ(target.closest(".node-control"), "afterend", 
                    Number(target.dataset.ptype)
                )
                myNode.activeNode.node_id = questionNode.nodeId
                return
            case "del-node":
                node?.delme()
                return
            case "reset-input":
                if (node instanceof myclass.QuestionNode || node instanceof myclass.CodeNode) {
                    reseter.resetNode(node)
                }
                return
        }
        if (node instanceof myclass.CodeNode) {
            switch (action) {
                case "exec":
                    await kh.execute(node.nodeId)
                    break;
                case "interrupt-kernel":
                    await kh.kernelInterrupt()
                    break;
            }
        }
        else if (node instanceof myclass.QuestionNode) {
            switch (action) {
                case "test":
                    await node.scoring()
                    break;
                case "cancel-test":
                    await node.canceling()
                    break;
                case "load-ipynb":
                    const file = await helper.filePicker()
                    const loc = node.answerField
                    const user = helper.isCreateMode()? 1 : 0
                    await utils.loadIpynb(file, loc, user)
                    break;
                case "exec-all":
                    await kh.executeAll(node.answerField)
                    break;
            }
        }
        else if (node instanceof myclass.ExplainNode) {
            switch (action) {
                case "embed-bold":
                    node.embedBold();
                    break;
                case "embed-italic":
                    node.embedItalic();
                    break;
                case "embed-href":
                    node.embedLink();
                    break;
                case "embed-img":
                    node.embedImg();
                    break;
                case "embed-FIB":
                    node.addFillInBlankProblem();
                    break;
                case "embed-select":
                    node.addSelectionProblem();
                    break;
                case "show-preview":
                    node.showPreview();
                    break;
            }
        }
    }
    catch (e) {
        if (e instanceof error.ApplicationError) {
            alert(e.message)
        }
        else {
            alert("Unexpected error")
            console.error(e)
        }
    }
    finally {
        target.classList.remove("disabled")
    }
})

// Event Listener (key down)
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
            if (!helper.isCreateMode()) {
                await currentActiveNode.scoring()
            } 
        }
    }
    // ============================== 
    //    Enter
    // ============================== 
    else if (e.key == "Enter" && e.target?.tagName == "BODY") {
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
                const nodeControl = currentActiveNode.answerField.querySelector(".node-control")
                if (nodeControl != null) {
                    const nextActiveNode = await utils.addCode(nodeControl, "afterend", {
                        user: Number(helper.isCreateMode())
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
    //    Escape
    // ============================== 
    else if (e.key == "Escape") {
        if (currentActiveNode instanceof myclass.EditorNode && e.target?.tagName == "BODY") {
            const e = currentActiveNode.parentQuestionNode
            if (e != null) {myNode.activeNode.node_id = e.nodeId}
        }
        else if (e.target?.tagName == "TEXTAREA") {
            const targetNode = myNode.get(e.target?.closest(".node") ?? myclass.emptyNodeId)
            if (targetNode instanceof myclass.EditorNode) {targetNode.editor.blur()}
        }
        else {
            e.target?.blur()
            if (currentActiveNode instanceof myclass.QuestionNode) {
                currentActiveNode._hideToast()
            }
        }
    }

    // ============================== 
    //    Ctrl-S
    // ============================== 
    else if (e.ctrlKey && e.key == "s" && e.target?.tagName == "BODY") {
        e.preventDefault()
        if (!helper.isCreateMode()) {
            await utils.saveUserData()
        } else {
            await utils.registerProblem()
        }
    }
    // ============================== 
    //    J or K
    // ============================== 
    else if ((e.key == "j" || e.key == "k") && e.target?.tagName == "BODY") {
        if (currentActiveNode == null) {return}
        const nextActiveNode = (e.key == "j") ? 
            myNode.nextNode(currentActiveNode) : myNode.prevNode(currentActiveNode)
        if (nextActiveNode != null) {
            myNode.activeNode.node_id = nextActiveNode.nodeId
            const {top, bottom} = nextActiveNode.element.getBoundingClientRect()
            if (top < 0 || bottom > window.innerHeight) {
                nextActiveNode.element.scrollIntoView({"behavior": "instant", "block": "center"})
            }
        }
    }
    // ============================== 
    //    Ctrl-L
    // ============================== 
    else if (e.ctrlKey && e.key == "l" && e.target?.tagName == "BODY") {
        e.preventDefault()
        if (currentActiveNode != null) {
            currentActiveNode.element.scrollIntoView({"behavior": "instant", "block": "center"})
        }
    }
    // ============================== 
    //    B or A
    // ============================== 
    else if ((e.key == "b" || e.key == "a") && e.target?.tagName == "BODY") {
        if (currentActiveNode == null) {return}
        const nodeCotnrol = (e.key == "b") ? 
                currentActiveNode.element.nextElementSibling : currentActiveNode.element.previousElementSibling
        if (nodeCotnrol != null && nodeCotnrol.classList.contains("node-control")) {
            await utils.addCode(nodeCotnrol, "afterend", {
                user: Number(helper.isCreateMode())
            })
        }
    }
    // ============================== 
    //    Ctrl + D
    // ============================== 
    else if (e.ctrlKey && e.key == "d" && e.target?.tagName == "BODY") {
        e.preventDefault()
        if (currentActiveNode == null) {return}
        try {
            if (currentActiveNode.allowDelete()) {
                let nextNode = 
                    myNode.nextNode(currentActiveNode)
                    || myNode.prevNode(currentActiveNode)
                    || currentActiveNode.parentQuestionNode
                currentActiveNode.delme()
                myNode.activeNode.node_id = nextNode.nodeId
            }
        } catch (e) {}
                
    }
})
// イベントリスナー (dblclick)
window.addEventListener("dblclick", e => {
    const target = e.target?.closest(".node.explain")
    if (target != null) {
        new myclass.ExplainNode(target).showEditor()
    }
})

document.querySelector("input#ipynbForm")?.addEventListener("change", async e => {
    const file = e.target?.files[0]
    const loc = document.querySelector("#nodesContainer")
    if (loc == null) {
        alert("unexpected error")
        return
    }
    const user = helper.isCreateMode() ? 1 : 0
    await utils.loadIpynb(file, loc, user)

})

const runState = {
    idle: "idle",
    running: "running",
    suspending: "suspending"
}

/**
 * KernelHandler classのrunningパラメータが変化した際に起動する関数
 * @param {boolean} oldValue
 * @param {boolean} newValue 
 */
function setExecuteAnimation(kh, oldValue, newValue) {
    // コード実行中(kh.running == true)の時
    if (newValue) {
        try {
            const runningNode = new myclass.CodeNode(kh.execute_task_q[0])
            runningNode.element.setAttribute("run-state", runState.running)
            runningNode.element.querySelector(".node-side")?.classList.add("bg-success-subtle")
            kh.execute_task_q.slice(1, ).forEach(id => {
                new myclass.CodeNode(id).element.setAttribute("run-state", runState.suspending)
            })
        } catch(e) {
            if (e instanceof myclass.NodeError) {}
            else {console.error(e)}
        }
    // 非コード実行中(kh.running == false)の時
    } else {
        document.querySelectorAll(".code").forEach(elem => {
            elem.setAttribute("run-state", runState.idle)
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
            const return_form = new myclass.CodeNode(newValue.node_id).element.querySelector(".return-box")
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
            const escapedt = helper.escapeHTML(res)
            form.insertAdjacentHTML("beforeend", `<p class="exec-res">${escapedt}</p>`)
            break;
        case "img":
            form.insertAdjacentHTML("beforeend",`<img class="exec-res ms-2" src="data:image/png;base64,${res}" style="max-width: 95%;"/>`)
            break;
        case "error":
            const escapede = helper.escapeHTML(res, true).replace(/\n/g, "<br>")
            form.insertAdjacentHTML("beforeend", `<p class="text-danger exec-res">${escapede}</p>`)
            break;
        default:
            throw new Error('"type" argument can be one of "text", "img", or "error".')
    }
}
/**
 * activeNodeがnode_idを変更した際の処理を行う関数
 * @param {Object} activeNode 
 * @param {String | undefined} oldNodeId 
 * @param {String} newNodeId 
 */
function setActiveNodePointer(activeNode, oldNodeId, newNodeId) {
    const oldNode = myNode.get(oldNodeId ?? myclass.emptyNodeId)
    const newNode = myNode.get(newNodeId ?? myclass.emptyNodeId)
    if (oldNode) {oldNode.element.classList.remove("active-node")}
    if (newNode) {newNode.element.classList.add("active-node")}
}