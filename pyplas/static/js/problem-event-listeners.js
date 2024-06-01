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
    }
    hljs.highlightAll()
    // カーネルの起動, wsの接続
    await kh.setUpKernel()

    // イベントリスナー (左サイドバー)
    document.querySelector("#kernel-ops").addEventListener("click", async e => {
        const target = e.target.closest(".btn-restart, .btn-interrupt, .btn-save")
        if (target) {
            target.classList.add("disabled")
              // kernel restart ボタン
            if (target.classList.contains("btn-restart")) {
                kh.ws.close()
                await kh.setUpKernel()
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

    // イベントリスナー (メイン)
    document.querySelector("#sourceCode").addEventListener("click", async e => {
        const target = e.target.closest(".btn-exec, .btn-interrupt, .btn-testing, .btn-cancel")
        if (target) {
            target.classList.add("disabled")
              // execute ボタン
            if (target.classList.contains("btn-exec")) { 
                const node = target.closest(".code")
                node.setAttribute("run-state", "suspending")
                await kh.execute(node)
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
            }
            target.classList.remove("disabled")
        }
    })
    // イベントリスナー (Key down)
    window.addEventListener("keydown", async e => {
        // Ctrl-Enter
        if (e.ctrlKey && e.code == "Enter") {
            const target = e.target.closest(".mde, .code")
              // In MDE
            if (target.classList.contains("mde")) {
                showPreview(target.querySelector(".node-mde"))
            } // In Python editor
            else if (target.classList.contains("code")) {
                if (target.getAttribute("run-state") == "suspending") {
                    await kh.kernelInterrupt()
                }
                else {
                    target.setAttribute("run-state", "suspending")
                    await kh.execute(target)
                }
            }
        }
    })

    watchValue(kh, "running", setExecuteAnimation)
    watchValue(kh, "msg", renderMessage)
})

/**
 * KernelHandler classのrunningパラメータが変化した際に起動する関数
 * @param {KernelHandler} kh 
 * @param {bool} newValue 
 */
function setExecuteAnimation(kh, newValue) {
    // コード実行中(kh.running == true)の時
    if (newValue) {
        kh.execute_task_q[0].setAttribute("run-state", "running")
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
        var return_form = document.querySelector(`div[node-id='${newValue.node_id}'] .return-box`)
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
                kh.execute_task_q = [kh.execute_task_q[0]]
                break;
            case "exec-end-sig":
                kh.running = false
                kh.execute_task_q.shift()
                if (kh.execute_task_q[0]) {
                    kh.executeCode()
                }
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
