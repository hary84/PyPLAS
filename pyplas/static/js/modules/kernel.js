
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
            console.log("[WS] WS connecting ...")
        }
        this.ws.onmessage = (event) => {
            var data = JSON.parse(event.data)
            this.msg = data
        }
        this.ws.onclose = function() {
            console.log("[WS] WS disconnecting ...")
        }
    }
    /**
     * カーネルidをインスタンスとsessionStorageに保存する
     * @param {String} kernel_id 
     */
    registerKernelId = (kernel_id) => {
        this.kernel_id = kernel_id
        sessionStorage["kernel_id"] = this.kernel_id
    }
    /**
     * カーネルidが有効かを調べる
     * @param {string} kernel_id 
     * @returns {bool} 
     */
    isAliveKernel = async (kernel_id) => {
        var id = (kernel_id) ? kernel_id : this.kernel_id
        var res = await fetch(`${window.location.origin}/kernel/${id}`, {method: "GET"})
        if (res.ok) {
            var json = await res.json()
            console.log(`[KernelHandler] ${json.DESCR}`)
            return json.is_alive
        }
    }
    /**
     * 有効なすべてのカーネルidを取得する
     * @returns {List}
     */
    getKernelIds = async () => {
        var res = await fetch(`${window.location.origin}/kernel`, {method: "GET"})
        if (res.ok) {
            var json = await res.json()
            console.log(`[KernelHandler] ${json.DESCR}`)
            return json.kernel_ids
        }
    }
    /**
     * カーネルを起動する.
     * カーネルがすでに存在している場合、kernelRestart()でカーネルを再起動する.
     * 
     * このメソッドは直接呼び出さず、setUpKernel()からのみ呼び出す.
     */
    kernelStart = async () => {
        var id = (this.kernel_id) ? this.kernel_id : ""
        var res = await fetch(`${window.location.origin}/kernel/${id}`, {method: "POST"})
        var json = await res.json()
        console.log(`[Kernelhandler] ${json.DESCR}`)   
        if (!res.ok) {
            await this.kernelRestart()
        }
        else {
            this.registerKernelId(json.kernel_id)
        }
    }
    /**
     * REST API を用いてカーネルを再起動する
     * 
     * このメソッドは直接呼び出さず、kernelStart(), setUpKernel()からのみ呼び出す
     */
    kernelRestart = async () => {
        var res = await fetch(`${window.location.origin}/kernel/${this.kernel_id}/restart`,
                              {method: "POST"})
        var json = await res.json()
        console.log(`[KernelHandler] ${json.DESCR}`)
        if (res.ok) {
            this.registerKernelId(json.kernel_id)
        }
        else {
            throw new Error("Fail to start kernel.")
        }
    }
    /**
     * REST API を用いてカーネルに中断指示を出す
     */
    kernelInterrupt = async (kernel_id) => {
        var id = (kernel_id) ? kernel_id : this.kernel_id
        var res = await fetch(`${window.location.origin}/kernel/${id}/interrupt`,
                              {method: "POST"})
        var json = await res.json()
        console.log(`[KernelHandler] ${json.DESCR}`)
    }
    /**
     * websocketを用いてコードの実行命令を出す
     */
    executeCode = () => {
        var node = this.execute_task_q[0]
        var node_id = node.getAttribute("node-id")
        var node_code = node.querySelector(".node-code")
        node.querySelector(".return-box").innerHTML = ""
        var msg = JSON.stringify({
            "code": ace.edit(node_code).getValue(),
            "node_id": node_id
        })
        this.ws.send(msg)
        console.log(`[KernelHandler] Executing code (node-id=${node_id})`)
        this.running = true
        this.execute_counter += 1
    }
    /**
     * Nodeを実行タスクキュー(execute_task_q)に格納する
     * execute_task_qが空だった場合、即座に実装指示を出す
     * @param {DOM} node 
     */
    execute = async (node) => {
        // 実行中のNodeと実行したいNodeが同じ場合
        if (this.execute_task_q[0] && this.execute_task_q[0].getAttribute("node-id") 
                    == node.getAttribute("node-id")){
            await this.kernelInterrupt()
        } 
        // それ以外の場合
        else {
            this.execute_task_q.push(node)
            // execute_task_qが空だった場合, 実行指示を出す
            if (this.execute_task_q.length == 1) {
                this.running = false
                this.executeCode()
            }
        }
    } 
}
