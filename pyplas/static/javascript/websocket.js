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
    console.log(`[LOG] ws reseaved: ${data}`)
    if (data.msg_type == "execute_result") {
        $("pre").append(`<p>${data.output}</p>`)
    } 
}

ws.onclose = function() {
    console.log("[LOG] ws disconnecting ... ")
}

$("#send-code").on("click", function(){
    var code = $("#code").val()
    var msg = JSON.stringify({"ops": "exec", "code": code})
    console.log("[LOG] ws send: " + msg)
    ws.send(msg)
})


