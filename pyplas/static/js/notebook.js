// for /create/<p_id> or /problems/<p_id>
//@ts-check
import { myNode } from "./modules/nodes.js"
import * as nodes from "./modules/nodes.js"
import * as utils from "./modules/utils.js"
import { notNull, problem_meta } from "./modules/helper.js"
import * as helper from "./modules/helper.js"
import reseter from "./modules/reset-manager.js"
import * as error from "./modules/error.js"
import exeHandler from "./modules/kernel.js"

const nodesContainer = notNull(document.querySelector("#nodesContainer"))

// ノードの有効化
document.querySelectorAll("[data-role='node']").forEach(e => {
    const n = myNode.get(e)
    if (n instanceof nodes.ExplainNode) {
        n.showPreview()
    }
})
    
// markdown.js, highlight.jsの準備
document.querySelectorAll(".explain:not([data-role='node'])").forEach(elem => {
    // @ts-ignore marked.js
    elem.innerHTML = marked.parse(helper.unescapeHTML(elem.innerHTML)) 
})
// @ts-ignore highlight.js
hljs.highlightAll();

if (problem_meta.mode == problem_meta.modes.problems) {
    await userAnswerCompletion()
    helper.addInnerLink(nodesContainer, notNull(document.querySelector("#rightSideBarScrollField")), "beforeend")
} 


// カーネルの起動・WebSocketの接続・プロパティの監視
await exeHandler.setUpKernel()
helper.watchValue(exeHandler, "running", setExecuteAnimation)
helper.watchValue(exeHandler, "msg", renderMessage)
helper.watchValue(myNode.activeNode, "node_id", setActiveNodePointer)

// ボタン，リンクをクリックイベントリスナー
document.querySelector("body")?.addEventListener("click", async e => {
    /** @type {HTMLElement | undefined} イベントを発生させたA, BUTTONタグの`Element` */
    const target = e.target?.closest("a, button")
    if (target === null || target === undefined) {return}

    /** 発生させるイベント */
    const action = target.dataset.action

    /** `target`を子要素に持つ`data-role='node'`の`Element`*/
    const nodeElement = target.closest("[data-role='node']")

    // 連続して発火しないようにボタン，リンクを無効化
    target.classList.add("disabled")
    try {
        // すべてのコードを実行
        if (action == "exec-all") {
            if (nodeElement !== null) {
                const n = myNode.get(nodeElement)
                if (n instanceof nodes.QuestionNode) {
                    exeHandler.executeAll(n.answerField)
                }
            }
            else {
                await exeHandler.executeAll(nodesContainer)
            }
        }// カーネルを再起動
        else if (action == "restart-kernel") {
            await exeHandler.restartKernel()
            document.querySelectorAll("[data-node-type='code']").forEach(e => {
                new nodes.CodeNode(nodes.getNodeParamsByElement(e).node_id).resetState()
            })
        }// カーネル実行を中断
        else if (action == "interrupt-kernel") {
            await exeHandler.kh.kernelInterrupt(exeHandler.kernel_id)
        }// ユーザ入力を保存 / 作成した問題を登録
        else if (action == "save") {
            switch (problem_meta.mode) {
                case problem_meta.modes.create:
                    await utils.registerProblem()
                    break;
                case problem_meta.modes.problems:
                    await utils.saveUserData()
                    break
            }
        }// ExplainNodeを追加
        else if (action == "add-MD") {
            e.stopPropagation()
            const nc = notNull(target.closest(".node-control"))
            const explainNode = await utils.addMD(nc, "afterend")
            myNode.activeNode.node_id = explainNode.node_id
        }// CodeNodeを追加
        else if (action == "add-Code") {
            e.stopPropagation()
            const nc = notNull(target.closest(".node-control"))
            const codeNode = await utils.addCode(nc, "afterend", {user: Number(problem_meta.isCreateMode())})
            myNode.activeNode.node_id = codeNode.node_id
        }// QuestionNodeを追加
        else if (action == "add-Question") {
            e.stopPropagation()
            const nc = notNull(target.closest(".node-control"))
            const questionNode = await utils.addQ(nc, "afterend", {
                ptype: Number(target.dataset.ptype)?? nodes.QuestionNode.ptypes.WORDTEST
            })
            myNode.activeNode.node_id = questionNode.node_id
        }// ノードを削除
        else if (action == "del-node") {
           myNode.get(notNull(nodeElement))?.delme()
        }// ユーザ入力を初期化
        else if (action == "reset-input") {
            const node = myNode.get(notNull(nodeElement))
            if (node instanceof nodes.QuestionNode || node instanceof nodes.CodeNode) {
                reseter.resetNode(node)
            }
        }// コード実行
        else if (action == "exec") {
            const node = myNode.get(notNull(nodeElement))
            if (node instanceof nodes.CodeNode) {
                await exeHandler.execute(node.node_id)
            }
        }// コード実行を中断
        else if (action == "interrupt-kernel") {
            const node = myNode.get(notNull(nodeElement))
            if (node instanceof nodes.CodeNode) {
                await exeHandler.kh.kernelInterrupt(exeHandler.kernel_id)
            }
        }
        else if (["test", "cancel-test", "load-ipynb"].includes(action)) {
            const node = myNode.get(notNull(nodeElement))
            if (!(node instanceof nodes.QuestionNode)) {return}
            // 問題の採点
            if (action == "test") {
                await node.scoring()
                const questionNavi = document.querySelector(`#question-nav a[href='#q-id-${node.q_id}']`)
                if (questionNavi === null) {return}
                questionNavi.dataset.qProgress = node.element.dataset.qProgress
            }// 採点の中断
            else if (action == "cancel-test") {
                await node.canceling()
            }// JupyterNotebookファイルを読み込む
            else if (action == "load-ipynb") {
                let file 
                try {
                    file = await helper.filePicker()
                } catch (e) {
                    return
                }
                const loc = node.answerField
                const user = problem_meta.isCreateMode()? 1 : 0
                await utils.loadIpynb(file, loc, user)
            }
        }
        else if ([
            "embed-bold",
            "embed-italic",
            "embed-href",
            "embed-img",
            "embed-FIB",
            "embed-select",
            "show-preview"]
        .includes(action)) {
            const node = myNode.get(notNull(nodeElement))
            if (!(node instanceof nodes.ExplainNode)) {return}
            if (action == "embed-bold") { node.embedBold() }
            else if (action == "embed-italic") {node.embedItalic() }
            else if (action == "embed-href") {node.embedLink() }
            else if (action == "embed-img") {node.embedImg() }
            else if (action == "embed-FIB") {node.addFillInBlankProblem() }
            else if (action == "embed-select") {node.addSelectionProblem()}
            else if (action == "show-preview") {node.showPreview()}
        }
    } catch(e) {
        alert(e.message)
        console.error(e)
    } finally {
        // ボタン，リンクを有効化
        target.classList.remove("disabled")
    }
})

// ノードをクリックしたときのイベントリスナー
document.querySelector("main")?.addEventListener("click", e => {
    try {
        const node = myNode.get(notNull(e.target?.closest("[data-role='node']")))
        if (node !== null) {
            myNode.activeNode.node_id = node.node_id
        }
    } catch {}
})

// キーボードを押したときのイベントリスナー
window.addEventListener("keydown", async e => {
    /** 現在アクティブなNode */
    const currentActiveNode = myNode.activeNode.get()
    /**
     * ============================================================  
     * Ctrl + Enter
     * 
     * アクティブノードが
     * - `ExplainNode`の場合, プレビューを表示
     * - `CodeNode`の場合, コード実行
     * - `QuestionNode`の場合，採点
     * ============================================================  
     */
    if (e.ctrlKey && e.key == "Enter") {
        if (currentActiveNode instanceof nodes.ExplainNode) {
            currentActiveNode.showPreview()
        } 
        else if (currentActiveNode instanceof nodes.CodeNode) {
            currentActiveNode.editor.blur()
            exeHandler.execute(currentActiveNode.node_id)
        }
        else if (currentActiveNode instanceof nodes.QuestionNode) {
            if (!problem_meta.isCreateMode()) {
                await currentActiveNode.scoring()
                const questionNavi = document.querySelector(`#question-nav a[href='#q-id-${currentActiveNode.q_id}']`)
                if (questionNavi === null) {return}
                questionNavi.dataset.qProgress = currentActiveNode.element.dataset.qProgress
            } 
        }
    }
    /**
     * ============================================================  
     * Enter
     * 
     * アクティブノードが
     * - `ExplainNode`の場合, エディタを表示
     * - `CodeNode`の場合, エディタにフォーカス
     * - `QuestionNode`の場合，内部の最初のNodeをアクティブに
     * ============================================================  
     */
    else if (e.key == "Enter" && e.target?.tagName == "BODY") {
        e.preventDefault()
        if (currentActiveNode instanceof nodes.ExplainNode) {
            currentActiveNode.showEditor()
            currentActiveNode.editor.focus()
        }
        else if (currentActiveNode instanceof nodes.CodeNode) {
            currentActiveNode.editor.focus()
        }
        else if (currentActiveNode instanceof nodes.QuestionNode) {
            const answerNodes = currentActiveNode.answerNodes
            if (answerNodes.length == 0) {
                const nodeControl = currentActiveNode.answerField.querySelector(".node-control")
                if (nodeControl != null) {
                    const nextActiveNode = await utils.addCode(nodeControl, "afterend", {
                        user: Number(problem_meta.isCreateMode())
                    })
                    myNode.activeNode.node_id = nextActiveNode.node_id
                }
            } 
            else {
                myNode.activeNode.node_id = answerNodes[0].node_id
            }
        }
    }
    /**
     * ============================================================  
     * Escape 
     * 
     * アクティブノードが
     * - `EditorNode`の場合，親に`QuestionNode`があれば，それをアクティブに
     * - `QuestionNode`の場合，トーストを非表示に
     * 
     * TEXTAREAにフォーカスしていた場合，フォーカスを解く
     * ============================================================  
     */
    else if (e.key == "Escape") {
        if (currentActiveNode instanceof nodes.EditorNode && e.target?.tagName == "BODY") {
            const e = currentActiveNode.parentQuestionNode
            if (e != null) {myNode.activeNode.node_id = e.node_id}
        }
        else if (e.target?.tagName == "TEXTAREA") {
            const targetNode = myNode.get(e.target?.closest("[data-role='node']"))
            if (targetNode instanceof nodes.EditorNode) {targetNode.editor.blur()}
        }
        else {
            e.target?.blur()
            if (currentActiveNode instanceof nodes.QuestionNode) {
                currentActiveNode._hideToast()
            }
        }
    }

    /**
     * ============================================================  
     * Ctrl-S
     * 
     * ユーザ入力を保存もしくは作成した問題を登録する
     * ============================================================  
     */
    else if (e.ctrlKey && e.key == "s" && e.target?.tagName == "BODY") {
        e.preventDefault()
        switch (problem_meta.mode) {
            case problem_meta.modes.problems:
                await utils.saveUserData()
                break
            case problem_meta.modes.create:
                await utils.registerProblem()
                break
        }
    }
    /**
     * ============================================================  
     * J or K
     * 
     * J => アクティブノードを次のノードに変える
     * K => アクティブノードを前のノードに変える
     * 
     * 同時に，アクティブノードがページ領域の中心になるようにスクロールする
     * ============================================================  
     */
    else if ((e.key == "j" || e.key == "k") && e.target?.tagName == "BODY") {
        if (currentActiveNode == null) {return}
        const nextActiveNode = (e.key == "j") ? 
            myNode.nextNode(currentActiveNode) : myNode.prevNode(currentActiveNode)
        if (nextActiveNode != null) {
            myNode.activeNode.node_id = nextActiveNode.node_id
            const {top, bottom} = nextActiveNode.element.getBoundingClientRect()
            if (top < 0 || bottom > window.innerHeight) {
                nextActiveNode.element.scrollIntoView({"behavior": "instant", "block": "center"})
            }
        }
    }
    /**
     * ============================================================  
     * Ctrl-L 
     * 
     * アクティブノードが画面の中心になるようにスクロール
     * ============================================================  
     */
    else if (e.ctrlKey && e.key == "l" && e.target?.tagName == "BODY") {
        e.preventDefault()
        if (currentActiveNode != null) {
            currentActiveNode.element.scrollIntoView({"behavior": "instant", "block": "center"})
        }
    }
    /**
     * ============================================================  
     * B or A
     * 
     * B => 前にコードノードを追加する
     * A => 次にコードノードを追加する
     * 
     * 現在のアクティブノードの直前・直後にNodeControlがなければ何もしない
     * ============================================================  
     */
    else if ((e.key == "b" || e.key == "a") && e.target?.tagName == "BODY") {
        if (currentActiveNode == null) {return}
        const nodeCotnrol = (e.key == "b") ? 
                currentActiveNode.element.nextElementSibling : currentActiveNode.element.previousElementSibling
        if (nodeCotnrol != null && nodeCotnrol.classList.contains("node-control")) {
            await utils.addCode(nodeCotnrol, "afterend", {
                user: Number(helper.problem_meta.isCreateMode())
            })
        }
    }
})


// ExplainNodeをダブルクリックしたときのイベントリスナー
window.addEventListener("dblclick", e => {
    try {
        const n = myNode.get(e.target?.closest("[data-node-type='explain']"))
        if (n instanceof nodes.ExplainNode) {
            n.showEditor()
        }
    } catch {}
})


// 読み込むJupyterNotebookファイル(.ipynb)が変化したときのイベントリスナー
document.querySelector("input#ipynbForm")?.addEventListener("change", async e => {
    const file = e.target?.files[0]
    const loc = nodesContainer
    const user = helper.problem_meta.isCreateMode() ? 1 : 0
    await utils.loadIpynb(file, loc, user)

})


/**
 * `ExecutionHandler`の`running`パラメータが変化した際に起動する関数
 * @param {boolean} oldValue `running`パラメータの変化前の値
 * @param {boolean} newValue `running`パラメータの変化後の値
 * 
 * @see {@link exeHandler.running}
 */
function setExecuteAnimation(exeHandler, oldValue, newValue) {
    // コード実行中(running == true)の時
    if (newValue) {
        try {
            const runningNode = new nodes.CodeNode(exeHandler.execute_task_q[0])
            runningNode.element.dataset.runState = nodes.CodeNode.runState.RUNNING
            exeHandler.execute_task_q.slice(1, ).forEach(id => {
                new nodes.CodeNode(id).element.dataset.runState = nodes.CodeNode.runState.QUEUED
            })
        } catch(e) {
            if (e instanceof nodes.NodeError) {}
            else {console.error(e)}
        }
    // 非コード実行中(running == false)の時
    } else {
        nodesContainer.querySelectorAll(":scope > [data-node-type='code']").forEach(elem => {
            const dataset = elem.dataset 
            if (dataset.runState == nodes.CodeNode.runState.QUEUED) {
                elem.dataset.runState = nodes.CodeNode.runState.IDLE
            }
        })
    }
}
/**
 * `ExecutionHandler`がWebSocketでメッセージを受信した際の処理を行う関数
 * @param {Object} oldValue 
 * @param {Object} newValue 
 * 
 * @see {@link exeHandler.msg}
 */
function renderMessage(kh, oldValue, newValue) {
    if (newValue) {
        try {
            const content = newValue.content
            const return_form = new nodes.CodeNode(newValue.node_id).element.querySelector(".return-box")
            switch (newValue.msg_type) {
                case "execute_result":
                    if (content["data"]["text/html"]) {
                        renderResult(content["data"]["text/html"], return_form, "html")
                    } else {
                        renderResult(content["data"]["text/plain"], return_form)
                    }
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
            if (e instanceof nodes.NodeError) {}
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
        case "html":
            form.insertAdjacentHTML("beforeend", res)
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
 * @param {String} oldNodeId 
 * @param {String} newNodeId 
 */
function setActiveNodePointer(activeNode, oldNodeId, newNodeId) {
    const oldNode = myNode.get(oldNodeId)
    const newNode = myNode.get(newNodeId)
    if (oldNode) {oldNode.element.classList.remove("active-node")}
    if (newNode) {newNode.element.classList.add("active-node")}
}

/**
 * APIを通じてユーザー入力を取得し，word testのQuestion Nodeを補完する
 */
async function userAnswerCompletion() {
    const res = await fetch(`${window.location.origin}/api/saves/${problem_meta.p_id}`)
    if (res.ok) {
        const json = await res.json()
        
        const saveDatas = json.saves
        nodesContainer.querySelectorAll("[data-node-type='question']").forEach(e => {
            const questionNode = myNode.get(e)
            if (questionNode instanceof nodes.QuestionNode) {
                if (questionNode.ptype == nodes.QuestionNode.ptypes.WORDTEST) {
                    if (saveDatas[questionNode.q_id] !== undefined) {
                        questionNode.answerCompletion(saveDatas[questionNode.q_id])
                    }
                }
            }
        })
    } 
    else {
        throw new error.FetchError(res.status, res.statusText)
    }
}