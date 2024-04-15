
$(function() {

    kh = new KernelHandler()

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

    $(".btn-testing").on("click", function() {
        kh.kernelInterrupt()
        var code = {}
        $(this).parents(".question").find(".node-code").each(function() {
            var id = $(this).attr("id")
            code[id] = ace.edit(id).getValue()
        })
        $.ajax({
            url: window.location.href,
            type: "POST",
            contentType: "application/json",
            dataType: "json",
            data: JSON.stringify({"qid": $(this).parents(".question").attr("q-id"), 
                                  "code": code, 
                                  "kernel_id": kh.kernel_id}),
            success: (data) => {
                console.log("SAVE YOUR ANSWER")
                console.log(data)
            }
        })
    })

    $(".node").on("click", function() {
        $current_node = $(this)
    })

    $(window).on("keydown", function(e) {
        if (e.ctrlKey) {
            if (e.keyCode == 13) { // Ctrl-Enter
                kh.execute($current_node)
            } 
        }
    })
    $(".btn-exec").on("click", function() {
        $current_node = $(this).parents(".node")
        kh.execute($current_node)
    })

    $(".executing").on("click", function() {
        kh.kernelInterrupt()
    })

    watchValue(kh, "running", setExecuteAnimation)
    watchValue(kh, "msg", renderMessage)
})

function setExecuteAnimation(kh, newValue) {
    if (newValue) {
        $side = kh.execute_task_q[0].find(".node-sidebutton")
        $side.children(".btn-exec").addClass("d-none")
        $side.children(".executing").removeClass("d-none")
    } else {
        $side = $(".node").find(".node-sidebutton")
        $side.children(".btn-exec").removeClass("d-none")
        $side.children(".executing").addClass("d-none")
    }
}

function renderMessage(kh, newValue) {
    if (newValue) {
        var content = newValue.content
        var $return_form = $(`#${newValue.id}`).parent().find(".return-box")

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
                kh.running = false
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

function watchValue(obj, propName, func) {
    let value = obj[propName];
    Object.defineProperty(obj, propName, {
        get: () => value,
        set: newValue => {
            const oldValue = value;
            value = newValue;
            func(obj, newValue);
        },
        configurable: true
    });
}