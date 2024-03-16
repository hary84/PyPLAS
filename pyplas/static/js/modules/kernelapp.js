
// Websocket connection and initial kernel start-up
function setUpKernel() {
    var host = window.location.host
    var kernel_id = sessionStorage["kernel_id"]
    if (!kernel_id) {
        kernelStart()
    }else {
        kernelRestart(kernel_id)
    }

    var ws = new WebSocket(`ws://${host}/ws/${sessionStorage["kernel_id"]}`)

    ws.onopen = function() {
        console.log("[LOG] ws connecting ...")
    }
    ws.onmessage = function(event) {
        var data = JSON.parse(event.data)
        // execute_node_q: The global que containing the node that sent the execution order
        var $exec_node = execute_node_q[0]
        var $return_form = $exec_node.find(".return-value")
        if (data.msg_type == "text") {
            $return_form.append(`<p class="exec-res">${data.msg}</p>`)
        } else if (data.msg_type == "image/png") {
            $return_form.append(`<img src="data:image/png;base64,${data.msg}" />`)
        } else if (data.msg_type == "error") {
            console.log("error")
            $return_form.append(`<p class="exec-error">${data.msg}</p>`)
        } else if (data.msg_type == "status") {
            execute_node_q.shift()
        }
    }
    ws.onclose = function() {
        console.log("[LOG] ws disconnecting ...")
    }

    return ws
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

// Start kernel with random id
function kernelStart(logging=true) {
    var origin = window.location.origin
    $.ajax({
        url: `${origin}/kernel`,
        type: "POST",
        async: false,
        success: function(data) {
            var kernel_id = data["kernel_id"]
            sessionStorage["kernel_id"] = kernel_id
            if (logging) console.log(`[kernel] kernel(${kernel_id}) start`)
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
