
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
            this.msg = data
        }
        this.ws.onclose = function() {
            console.log("[LOG] ws disconnecting ...")
        }
    }
    
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
        console.log("send kernel interrupt signal")
        $.ajax({
            url: `${window.location.origin}/kernel/${this.kernel_id}?action=interrupt`,
            type: "POST",
            async: true,
            success: (data) => {
                console.log("Kernel Interrupted")
                this.running = false
            }
        })
    }

    executeCode = () => {
        this.running = true
        var $node = this.execute_task_q[0]
        var id = $node.find(".node-code").attr("id")
        $node.find(".exec-res").remove()
        var qid = ($node.parents(".question").length) ? $node.parents(".question").attr("q-id") : ""
        var msg = JSON.stringify({"id": id, 
                                  "qid": qid,
                                  "code": ace.edit(id).getValue()})
        this.ws.send(msg)
    }

    execute = ($node) => {
        if (this.execute_task_q[0] && this.execute_task_q[0].attr("node-id") == $node.attr("node-id")) {
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
