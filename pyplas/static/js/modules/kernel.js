
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
        if ($prime.parents(".question").length) {
            var ops = "test"
            var qid = $prime.parents(".question").attr("q-id")
        } else {
            var ops = "exec"
            var qid = ""
        }
        var code = ace.edit(id).getValue()
        var msg = JSON.stringify({"ops": ops, "code": code, "id": id, "q-id": qid})
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
