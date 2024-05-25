// for /create/<p_id> or /problems/<p_id>

$(function() {
    var groups = window.location.pathname.match(/(?<parent_path>problems|create)\/(?<p_id>[-\w]+)/).groups
    var p_id = groups.p_id
    var parent = groups.parent_path
    console.log(`problem_id(p_id) is ${p_id}`)
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

    kh = new KernelHandler()

    document.querySelector(".btn-save").addEventListener("click", function(e) {
        if (parent == "problems") {
            saveUserData(p_id)
        }
        else if (parent == "create") {
            registerProblem()
        }
    })

    $(".btn-restart").on("click", function() {
        kh.ws.close()
        $(".node-number").each(function() {
            $(this).text("")
        })
        kh.setUpKernel()
    })

    $(".btn-interrupt").on("click", function() {
        kh.kernelInterrupt()
    })

    var sourcecode = document.querySelector("#sourceCode")
    sourcecode.addEventListener("click", function(e) {
        var code = e.target.closest(".code")
        if (code) {
            $current_node = code
        }
        var target = e.target.closest(".btn-exec, .btn-interrupt, .btn-testing, .btn-cancel")
        if (target) {
            if (target.classList.contains("btn-exec")) {
                $current_node = target.closest(".code")
                kh.execute($current_node)
            } else if (target.classList.contains("btn-interrupt")) {
                kh.kernelInterrupt()
            } else if (target.classList.contains("btn-testing")) {
                scoring(target.closest(".node.question"))
            } else if (target.classList.contains("btn-cancel")) {
                cancelScoring()
            }
        }
    })

    $(window).on("keydown", function(e) {
        if (e.ctrlKey) {
            if (e.keyCode == 13) { // Ctrl-Enter
                kh.execute($current_node)
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
        var $return_form = $(`div[node-id='${newValue.node_id}']`).find(".return-box")
        switch (newValue.msg_type) {
            case "execute_result":
                _renderResult(content["data"]["text/plain"], $return_form)
                break;
            case "stream":
                _renderResult(content["text"], $return_form)
                break;
            case "display_data":
                _renderResult(content["data"]["text/plain"], $return_form)
                _renderResult(content["data"]["image/png"], $return_form, "img")
                break;
            case "error":
                var error_msg = content["traceback"].join("\n")
                _renderResult(error_msg, $return_form, "error")
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
    _renderResult = (res, $form, type="text") => {
        switch (type) {
            case "text":
                var res = _escapeHTML(res)
                $form.append(`<p class="exec-res">${res}</p>`)
                break;
            case "img":
                $form.append(`<img class="exec-res" src="data:image/png;base64,${res}"/>`)
                break;
            case "error":
                var res = _escapeHTML(res, true).replace(/\n/g, "<br>")
                $form.append(`<p class="text-danger exec-res">${res}</p>`)
                break;
            default:
                throw new Error('"type" argument can be one of "text", "img", or "error".')
        }
    }
    
    _escapeHTML = (str, ansi=false) => {
        if (ansi) {
            var str =  str.replace(/\x1B[[;\d]+m/g, "")
        }
        return $("<p/>").text(str).html()
    }
}
/**
 * ユーザーの入力を保存する
 * @param {string} p_id 
 */
function saveUserData(p_id) {
    q_content = {}
    document.querySelectorAll(".question").forEach(elem => {
        var params = extractQuestionNode(elem, mode=0)
        q_content[params.q_id] = params.answers
    })

    fetch(`${window.location.origin}/problems/${p_id}`, {
        method: "PUT",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
            "q_content": q_content
        })
    }).then(res => res.json()).then(data => {
        if (data.status == 200) {
            console.log(`[SAVE] ${data.DESCR}`)
        } 
    })
}