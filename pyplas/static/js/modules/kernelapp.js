
// Websocket connection and initial kernel start-up
function setUpKernel(kernel_start=true) {
    var host = window.location.host
    var kernel_id = sessionStorage["kernel_id"]

    if (kernel_start) kernelStart(kernel_id)

    var ws = new WebSocket(`ws://${host}/ws/${sessionStorage["kernel_id"]}`)
    ws.onopen = function() {
        console.log("[LOG] ws connecting ...")
    }
    ws.onmessage = function(event) {
        var data = JSON.parse(event.data)
        // execute_node_q: The global que containing the node that sent the execution order
        var $exec_node = execute_node_q[0]
        var $return_form = $exec_node.find(".return-value")

        var content = data.content
        console.log(data)
        switch (data.msg_type) {
            case "execute_result":
                renderResult(content["data"]["text/plain"], $return_form)
                break;
            case "stream":
                renderResult(content["text"], $return_form)
                break;
            case "display_data":
                renderResult(content["data"]["text/plain"], $return_form)
                renderResult(content["data"]["image/png"], $return_form, type="img")
                break;
            case "error":
                var error_msg = content["traceback"].join("\n")
                renderResult(error_msg, $return_form, type="error")
                break;
            case "exec-end-sig":
                execute_node_q.shift()
                break;
        }
    }
    ws.onclose = function() {
        console.log("[LOG] ws disconnecting ...")
    }

    return ws
}

function renderResult(res, $form, type="text") {
    console.log(type)
    switch (type) {
        case "text":
            var res = escapeHTML(res)
            $form.append(`<p class="exec-res">${res}</p>`)
            break;
        case "img":
            $form.append(`<img src="data:image/png;base64,${res}"/>`)
            break;
        case "error":
            var res = escapeHTML(res, ansi=true)
            $form.append(`<p class="exec-error">${res}</p>`)
            break;
        default:
            throw new Error('"type" argument can be one of "text", "img", or "error".')
    }
}

function escapeHTML(str, ansi=false) {
    if (ansi) {
        str =  str.replace(/\x1B[[;\d]+m/g, "")
    }
    return $("<p/>").text(str).html()
}

// Execute code in $node using websocket.
function executeCode($node, ws) {
    var $prime = $node.find(".node-prime")
    $prime.find(".return-value").empty()
    var id = $prime.find(".node-code").attr("id")
    var editor = ace.edit(id)
    var code = editor.getValue()
    var msg = JSON.stringify({"ops": "exec", "code": code})
    ws.send(msg)
    console.log(msg)
}

// Get the ID of the kernel you are running.
function getKernelIds(kernel_id, async=true) {
    var origin = window.location.origin
    if (!kernel_id) var kernel_id = ""
    $.ajax({
        url: `${origin}/kernel/${kernel_id}`,
        type: "GET",
        async: async,
        success: function(data) {
            if (data["status"] == "success") {
                console.log(data["is_alive"])
            }
        }
    })
}

// Start kernel 
function kernelStart(kernel_id, logging=true) {
    var origin = window.location.origin
    if (!kernel_id) var kernel_id = ""
    $.ajax({
        url: `${origin}/kernel/${kernel_id}`,
        type: "POST",
        async: false,
        success: function(data) {
            if (data.status == "success") {
                var kernel_id = data["kernel_id"]
                sessionStorage["kernel_id"] = kernel_id
                if (logging) console.log(`[kernel] kernel(${kernel_id}) start`)
            } else if (data.status == "error") {
                console.log(data.DESCR)}
        }
    })
}

// Restart kernel with specified id
function kernelRestart(kernel_id, async=true, logging=false) {
    var origin = window.location.origin
    $.ajax({
        url: `${origin}/kernel/${kernel_id}?action=restart`,
        type: "POST",
        async: async,
        success: function(data) {
            if (logging) {
                if (data["status"] == "success") {
                    alert(`kernel (${kernel_id}) restarted`)
                }
            }
        }
    })
}

// Suspend the specified kernel
function kernelInterrupt(kernel_id, async=true, logging=false) {
    var origin = window.location.origin
    $.ajax({
        url: `${origin}/kernel/${kernel_id}?action=interrupt`,
        type: "POST",
        async: async,
        success: function(data) {
            if (data["status"] == "success") {
                if(logging)  alert("kernel interrupt")
            }
        }
    })
}

// Shutdown the specified kernel
function kernelShutdonw(kernel_id, async=true, logging=true) {
    var origin = window.location.origin
    $.ajax({
        url: `${origin}/kernel/${kernel_id}`,
        type: "DELETE",
        async: async,
        success: function(data) {
            if (data["status"] == "success") {
                if (logging) console.log(`[kernel] kernel(${kernel_id}) is shut down.`)
                sessionStorage.removeItem("kernel_id")
            } 
        }
    })
}
