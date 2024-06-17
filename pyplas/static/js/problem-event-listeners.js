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

    // イベントリスナー (左サイドバー)
    document.querySelector("#kernel-ops").addEventListener("click", async e => {
        const target = e.target.closest("a, button")
        if (target) {
            target.classList.add("disabled")
              // execute all ボタン
            if (target.classList.contains("btn-exec-all")) {
                await kh.executeAll(document.querySelector("#nodesContainer"))
            }
              // kernel restart ボタン
            else if (target.classList.contains("btn-restart")) {
                await kh.setUpKernel(true)
                document.querySelectorAll(".node.code .return-box").forEach(elem => {
                    elem.innerHTML = ""
                })
            } // kernel interrupt ボタン
            else if (target.classList.contains("btn-interrupt")) {
                await kh.kernelInterrupt()
            } // problem save ボタン
            else if (target.classList.contains("btn-save")) {
                if (parent == "problems") {         // problemページの場合
                    await saveUserData(p_id)
                } else if (parent == "create") {    // createページの場合
                    await registerProblem(p_id)
                }
            }
            target.classList.remove("disabled")
        }
    })
    const manageScoring = {}

    // イベントリスナー (メイン, click)
    document.querySelector("#sourceCode").addEventListener("click", async e => {
        const target = e.target.closest("a, button")
        // console.log(target)
        if (target) {
            target.classList.add("disabled")
              // execute ボタン
            if (target.classList.contains("btn-exec")) { 
                const node_id = target.closest(".code").getAttribute("node-id")
                await kh.execute(node_id)
            } // interrupt ボタン
            else if (target.classList.contains("btn-interrupt")) {
                await kh.kernelInterrupt()
            } // answer ボタン
            else if (target.classList.contains("btn-testing")) { 
                const q_id = target.closest(".node.question").getAttribute("q-id")
                const kernel_id = crypto.randomUUID()
                manageScoring[q_id] = kernel_id
                await scoring(p_id, q_id, kernel_id)
                delete manageScoring[q_id]
            } // cancel ボタン
            else if (target.classList.contains("btn-cancel")) {
                const q_id = target.closest(".node.question").getAttribute("q-id")
                const kernel_id = manageScoring[q_id]
                await cancelScoring(p_id, kernel_id)
                delete manageScoring[q_id]
            } // add MD ボタン
            else if (target.classList.contains("btn-addMD")) {
                const inQ = !!target.closest(".question")
                await addMD(target.closest(".node-control"), "afterend", {
                    explain: parent == "create",
                    question: parent == "create" && !inQ
                })
            } // add Code ボタン
            else if (target.classList.contains("btn-addCode")) {
                const inQ = !!target.closest(".question")
                await addCode(target.closest(".node-control"), "afterend", {
                    user: Number(parent == "create"),
                    explain: parent == "create",
                    question: parent == "create" && !inQ
                })
            } // add Question ボタン
            else if (target.classList.contains("btn-addQ")) {
                await addQ(target.closest(".node-control"), "afterend", 
                            Number(target.dataset.ptype))
            }
            target.classList.remove("disabled")
        }
    })
    // イベントリスナー (Key down)
    window.addEventListener("keydown", async e => {
        // Ctrl-Enter
        if (e.ctrlKey && e.key == "Enter") {
            const target = e.target.closest(".mde, .code")
              // In MDE
            if (target.classList.contains("mde")) {
                showPreview(target.querySelector(".node-mde"))
            } // In Python editor
            else if (target.classList.contains("code")) {
                kh.execute(target.getAttribute("node-id"))
            }
        }
        // Ctrl-S
        else if (e.ctrlKey && e.key == "s") {
            if (e.target.tagName == "BODY") {
                if (parent == "problems") {
                    e.preventDefault()
                    saveUserData(p_id)
                } else if (parent == "create") {
                    e.preventDefault()
                    registerProblem(p_id)
                }
            }
        }
    })
    // イベントリスナー (dblclick)
    window.addEventListener("dblclick", e => {
        const target = e.target.closest(".for-preview")
        if (target) {
            if (target.classList.contains("for-preview")) {
                showEditor(target)
            }
        }
    })
})

/**
 * KernelHandler classのrunningパラメータが変化した際に起動する関数
 * @param {KernelHandler} kh 
 * @param {bool} newValue 
 */
function setExecuteAnimation(kh, newValue) {
    // コード実行中(kh.running == true)の時
    if (newValue) {
        getNodeElement(kh.execute_task_q[0]).setAttribute("run-state", "running")
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

function renderMessage(kh, newValue) {
    if (newValue) {
        var content = newValue.content
        var return_form = getNodeElement(newValue.node_id).querySelector(".return-box")
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
            form.insertAdjacentHTML("beforeend",`<img class="exec-res" src="data:image/png;base64,${res}"/>`)
            break;
        case "error":
            var res = escapeHTML(res, true).replace(/\n/g, "<br>")
            form.insertAdjacentHTML("beforeend", `<p class="text-danger exec-res">${res}</p>`)
            break;
        default:
            throw new Error('"type" argument can be one of "text", "img", or "error".')
    }
}

function escapeHTML(str, ansi=false) {
    if (ansi) {
        var str =  str.replace(/\x1B[[;\d]+m/g, "")
    }
    return str.replace(/[&'`"<>]/g, function(match) {
        return {
            '&': '&amp;',
            "'": '&#x27;',
            '`': '&#x60;',
            '"': '&quot;',
            '<': '&lt;',
            '>': '&gt;',
        }[match]
    });
}
