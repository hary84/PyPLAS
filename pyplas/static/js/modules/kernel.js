
class KernelHandler {
    constructor() {
        this.setUpKernel()
    }
    /**
     * インスタンス変数の初期化とカーネルの起動を行う
     */
    setUpKernel = async () => {
        this.execute_task_q = []
        this.execute_counter = 0
        this.running = false
        this.msg = undefined
        this.kernel_id = sessionStorage["kernel_id"]
        
        await this.kernelStart()

        this.ws = new WebSocket(`ws://${window.location.host}/ws/${this.kernel_id}`)
        this.ws.onopen = () => {
            console.log("[LOG] ws connecting ...")
        }
        this.ws.onmessage = (event) => {
            var data = JSON.parse(event.data)
            console.log(data)
            this.msg = data
        }
        this.ws.onclose = function() {
            console.log("[LOG] ws disconnecting ...")
        }
    }
    /**
     * カーネルidをインスタンスとsessionStorageに保存する
     * @param {String} kernel_id 
     */
    registerKernelId = (kernel_id) => {
        this.kernel_id = kernel_id
        this.test_kernel_id = "test_" + kernel_id
        sessionStorage["kernel_id"] = this.kernel_id
        sessionStorage["test_kernel_id"] = this.test_kernel_id
    }
    /**
     * カーネルidが有効かを調べる
     * @param {String} kernel_id 
     * @returns {bool} 
     */
    isAliveKernel = async (kernel_id) => {
        var id = (kernel_id) ? kernel_id : this.kernel_id
        var res = await fetch(`${window.location.origin}/kernel/${id}`, {method: "GET"})
        var json = await res.json()
        return json.is_alive
    }
    /**
     * 有効なすべてのカーネルidを取得する
     * @returns {List}
     */
    getKernelIds = async () => {
        var res = await fetch(`${window.location.origin}/kernel`, {method: "GET"})
        var json = await res.json()
        return json.is_alive
    }
    /**
     * REST API を用いてカーネルを起動する
     */
    kernelStart = async () => {
        var id = (this.kernel_id) ? this.kernel_id : ""
        var res = await fetch(`${window.location.origin}/kernel/${id}`, {method: "POST"})
        var json = await res.json()
        if (json.status == "success") {
            console.log(json["DESCR"])
            this.registerKernelId(json.kernel_id)
        } else if (json.status == "error") {
            console.log(json["DESCR"])
            this.kernelRestart()
        }
    }
    /**
     * REST API を用いてカーネルを再起動する
     */
    kernelRestart = async () => {
        var res = await fetch(`${window.location.origin}/kernel/${this.kernel_id}?action=restart`,
                              {method: "POST"})
        var json = await res.json()
        if (json.status == "success") {
            console.log(json["DESCR"])
            this.registerKernelId(json.kernel_id)
        } else if(json.status == "error") {
            console.log(json["DESCR"])
        }
    }
    /**
     * REST API を用いてカーネルに中断指示を出す
     */
    kernelInterrupt = async (kernel_id) => {
        var id = (kernel_id) ? kernel_id : this.kernel_id
        var res = await fetch(`${window.location.origin}/kernel/${id}?action=interrupt`,
                              {method: "POST"})
        var json = await res.json()
        if (json.status == "success") {
            console.log(json["DESCR"])
        }
    }
    /**
     * websocketを用いてコードの実行命令を出す
     */
    executeCode = () => {
        this.running = true
        var node = this.execute_task_q[0]
        var node_id = node.getAttribute("node-id")
        var node_code = node.querySelector(".node-code")
        node.querySelector(".return-box").innerHTML = ""
        var msg = JSON.stringify({
            "code": ace.edit(node_code).getValue(),
            "node_id": node_id
        })
        this.ws.send(msg)
        this.execute_counter += 1
        // node.querySelector(".node-number").innerHTML = this.execute_counter
    }
    /**
     * Nodeを実行タスクキューに格納する
     * @param {DOM} node 
     */
    execute = (node) => {
        // 実行中のNodeと実行したいNodeが同じ場合
        if (this.execute_task_q[0] && this.execute_task_q[0].getAttribute("node-id") 
                    == node.getAttribute("node-id")){
            this.kernelInterrupt()
        } 
        // それ以外の場合
        else {
            this.execute_task_q.push(node)
            if (this.execute_task_q.length == 1) {
                this.executeCode()
            }
        }
    } 

}
