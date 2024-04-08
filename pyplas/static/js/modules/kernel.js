
class KernelHandler {
    constructor() {
        this.setUpKernel()
    }
    
    setUpKernel = () => {
        this.execute_task_q = []
        this.execute_counter = 0
        this.running = false
        this.msg = undefined
        this.kernel_id = sessionStorage["kernel_id"]
        
        if (this.kernel_id) {
            var id_lists = this.getKernelIds()
            if (id_lists.includes(this.kernel_id)) {
                this.kernelRestart()
            } else {
                this.kernelStart()
            }
        } else {
            this.kernelStart()
        }
        this.ws = new WebSocket(`ws://${window.location.host}/ws/${this.kernel_id}`)

        this.ws.onopen = () => {
            console.log("[LOG] ws connecting ...")
        }

        this.ws.onmessage = (event) => {
            var data = JSON.parse(event.data)
            // var content = data.content
            // var $return_form = $(`#${data.id}`).parent().find(".return-box")
    
            // switch (data.msg_type) {
            //     case "execute_result":
            //         this._renderResult(content["data"]["text/plain"], $return_form)
            //         break;
            //     case "stream":
            //         this._renderResult(content["text"], $return_form)
            //         break;
            //     case "display_data":
            //         this._renderResult(content["data"]["text/plain"], $return_form)
            //         this._renderResult(content["data"]["image/png"], $return_form, "img")
            //         break;
            //     case "error":
            //         var error_msg = content["traceback"].join("\n")
            //         this._renderResult(error_msg, $return_form, "error")
            //         this.execute_task_q = []
            //         break;
            //     case "exec-end-sig":
            //         this.running = false
            //         this.execute_task_q.shift()
            //         if (this.execute_task_q[0]) {
            //             this.executeCode()
            //         }
            //         break;
            // }
            this.msg = data
        }
        this.ws.onclose = function() {
            console.log("[LOG] ws disconnecting ...")
        }
    }

    // _renderResult = (res, $form, type="text") => {
    //     switch (type) {
    //         case "text":
    //             var res = this._escapeHTML(res)
    //             $form.append(`<p class="exec-res">${res}</p>`)
    //             break;
    //         case "img":
    //             $form.append(`<img class="exec-res" src="data:image/png;base64,${res}"/>`)
    //             break;
    //         case "error":
    //             var res = this._escapeHTML(res, true).replace(/\n/g, "<br>")
    //             $form.append(`<p class="text-danger exec-res">${res}</p>`)
    //             break;
    //         default:
    //             throw new Error('"type" argument can be one of "text", "img", or "error".')
    //     }
    // }
    
    // _escapeHTML = (str, ansi=false) => {
    //     if (ansi) {
    //         var str =  str.replace(/\x1B[[;\d]+m/g, "")
    //     }
    //     return $("<p/>").text(str).html()
    // }

    
    getKernelIds = () => {
        var data = $.ajax({
            url: `${window.location.origin}/kernel/`,
            type: "GET",
            async: false,
        }).responseJSON
        return data["is_alive"]
    }

    kernelStart = () => {
        var id = (this.kernel_id) ? this.kernel_id : ""
        $.ajax({
            url: `${window.location.origin}/kernel/${id}`,
            type: "POST",
            async: false,
            success: (data) => {
                if (data.status == "success") {
                    this.kernel_id = data["kernel_id"]
                    sessionStorage["kernel_id"] = this.kernel_id
                } else if (data.status == "error") {
                    console.log(data.DESCR)
                }
            }
        })
    }

    kernelRestart = () => {
        $.ajax({
            url: `${window.location.origin}/kernel/${this.kernel_id}?action=restart`,
            type: "POST",
            async: false,
            success: (data) => {
                this.execute_counter = 0
                this.execute_task_q = []
                console.log("kernel restart")
            }
        })
    }

    kernelInterrupt = () => {
        $.ajax({
            url: `${window.location.origin}/kernel/${this.kernel_id}?action=interrupt`,
            type: "POST",
            async: false,
            success: (data) => {
                console.log("Kernel Interrupted")
            }
        })
    }

    executeCode = () => {
        this.running = true
        var $prime = this.execute_task_q[0].find(".node-prime")
        var id = $prime.find(".node-code").attr("id")
        $prime.find(".return-box").children().remove(".exec-res")
        var ops = ($prime.parents(".card").length) ? "test" : "exec"
        var code = ace.edit(id).getValue()
        var msg = JSON.stringify({"ops": ops, "code": code, "id": id})
        this.ws.send(msg)
    }

    execute = ($node) => {
        if (this.execute_task_q[0] && this.execute_task_q[0].find(".node-code").attr("id") == $node.find(".node-code").attr("id")) {
            this.kernelInterrupt()
            return false 
        }
        this.execute_counter += 1
        $node.find(".node-number").text(this.execute_counter)
        this.execute_task_q.push($node)
        if (this.execute_task_q.length == 1) {
            this.executeCode()
        }
        return false
    } 

}
