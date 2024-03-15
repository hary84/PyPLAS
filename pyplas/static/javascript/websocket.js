host = window.location.host
kernel_id = sessionStorage["kernel_id"]

if (!kernel_id) {
    kernel_start()
} else {
    kernel_restart(kernel_id)
}

ws = new WebSocket(`ws://${host}/ws/${sessionStorage["kernel_id"]}`)

ws.onopen = function() {
    console.log("ws connectiong ...")
}

ws.onmessage = function(event) {
    var data = JSON.parse(event.data)
    var $return_form = $current_node.find(".return-value")

    if (data.msg_type == "text") {
        $return_form.append(`<p class="exec-res">${data.msg}</p>`)
    } else if (data.msg_type == "image/png") {
        $return_form.append(`<img src="data:image/png;base64,${data.msg}" />`)
    } else if (data.msg_type == "error") {
        console.log("error")
        $return_form.append(`<p class="exec-error">${data.msg}</p>`)
    }
}

ws.onclose = function() {
    console.log("[LOG] ws disconnecting ... ")
}

function execute_code() {
    kernel_interrupt(sessionStorage["kernel_id"], async=false)

    var $prime= $current_node.find(".node-prime")
    $prime.find(".return-value").empty()
    var id = $prime.find(".node-code").attr("id")
    var editor = ace.edit(id)
    var code = editor.getValue()
    var msg = JSON.stringify({"ops": "exec", "code": code})
    ws.send(msg)
}

