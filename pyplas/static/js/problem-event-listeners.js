// for /create/<p_id> or /problems/<p_id>

document.addEventListener("DOMContentLoaded", () => {
    const groups = window.location.pathname.match(/(?<parent_path>problems|create)\/(?<p_id>[-\w]+)/).groups
    var p_id = groups.p_id
    var parent = groups.parent_path
    console.log(`problem_id(p_id) is ${p_id}`)
    console.log(`parent path is ${parent}`)
    document.querySelectorAll(".node-mde").forEach(elem => registerAceMDE(elem)) // AceMDEの登録
    document.querySelectorAll(".node-code").forEach(elem => registerAceEditor(elem)) // AceEditorの登録

    // 右サイドバーにquestion nodeのリンクを配置
    if (parent == "problems") {
        var question_nav_bar = document.querySelector("#question-nav > .nav")
        document.querySelectorAll(".question").forEach((elem, i) => {
            question_nav_bar.insertAdjacentHTML("beforeend",
            `<a class="nav-link position-relative" href="#${elem.id}" progress=${elem.getAttribute("progress")}>Q. ${i+1}<span class="progress-badge badge position-absolute" style="right: 5%;"> </span></a>`)
        })
    }
    // カーネルの起動, wsの接続
    kh = new KernelHandler()

    // イベントリスナー (左サイドバー)
    document.querySelector("#kernel-ops").addEventListener("click", async e => {
        var target = e.target.closest(".btn-restart, .btn-interrupt, .btn-save")
        if (target) {
            target.classList.add("disabled")
            if (target.classList.contains("btn-restart")) {
                kh.ws.close()
                await kh.setUpKernel()
            } else if (target.classList.contains("btn-interrupt")) {
                await kh.kernelInterrupt()
            } else if (target.classList.contains("btn-save")) {
                if (parent == "problems") {
                    await saveUserData(p_id)
                } else if (parent == "create") {
                    await registerProblem(p_id)
                }
            }
            target.classList.remove("disabled")
        }
    })
    // イベントリスナー (右サイドバー)
    document.querySelector("#sourceCode").addEventListener("click", async e => {
        var code = e.target.closest(".code")
        if (code) {
            $current_node = code
        }
        var target = e.target.closest(".btn-exec, .btn-interrupt, .btn-testing, .btn-cancel")
        if (target) {
            target.classList.add("disabled")
            if (target.classList.contains("btn-exec")) { // execute ボタン
                $current_node = target.closest(".code")
                await kh.execute($current_node)
            } else if (target.classList.contains("btn-interrupt")) { // interrupt ボタン
                await kh.kernelInterrupt()
            } else if (target.classList.contains("btn-testing")) { // answer ボタン
                await scoring(p_id, target.closest(".node.question"))
            } else if (target.classList.contains("btn-cancel")) { // cancel ボタン
                await cancelScoring(p_id)
            }
            target.classList.remove("disabled")
        }
    })
    // イベントリスナー (Code Node)
    window.addEventListener("keydown", e => {
        if (e.ctrlKey && e.code == "Enter" && $current_node) {
            kh.execute($current_node)
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
        var side = kh.execute_task_q[0].querySelector(".node-side")
        side.classList.add("running")
    // 非コード実行中(kh.running == false)の時
    } else {
        document.querySelectorAll(".node-side").forEach(elem => {
            elem.classList.remove("running")
        })
    }
}

function renderMessage(kh, newValue) {
    if (newValue) {
        var content = newValue.content
        var return_form = document.querySelector(`div[node-id='${newValue.node_id}'] .return-box`)
        switch (newValue.msg_type) {
            case "execute_result":
                _renderResult(content["data"]["text/plain"], return_form)
                break;
            case "stream":
                _renderResult(content["text"], return_form)
                break;
            case "display_data":
                _renderResult(content["data"]["text/plain"], return_form)
                _renderResult(content["data"]["image/png"], return_form, "img")
                break;
            case "error":
                var error_msg = content["traceback"].join("\n")
                _renderResult(error_msg, return_form, "error")
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
    _renderResult = (res, form, type="text") => {
        switch (type) {
            case "text":
                var res = _escapeHTML(res)
                form.insertAdjacentHTML("beforeend", `<p class="exec-res">${res}</p>`)
                break;
            case "img":
                form.insertAdjacentHTML("beforeend",`<img class="exec-res" src="data:image/png;base64,${res}"/>`)
                break;
            case "error":
                var res = _escapeHTML(res, true).replace(/\n/g, "<br>")
                form.insertAdjacentHTML("beforeend", `<p class="text-danger exec-res">${res}</p>`)
                break;
            default:
                throw new Error('"type" argument can be one of "text", "img", or "error".')
        }
    }
    
    _escapeHTML = (str, ansi=false) => {
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
}
/**
 * ユーザーの入力を保存する
 * @param {string} p_id 
 */
async function saveUserData(p_id) {
    var q_content = {}
    document.querySelectorAll(".question").forEach(elem => {
        var params = extractQuestionNode(elem, mode=0)
        q_content[params.q_id] = params.answers
    })
    var res = await fetch(`${window.location.origin}/problems/${p_id}/save`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
            "q_content": q_content
        })})
    var json = await res.json()
    console.log(`[save] ${json.DESCR}`)
}