
class KernelHandler {
    /**
     * インスタンス変数の初期化とカーネルの起動を行う
     */
    setUpKernel = async () => {
        this.execute_task_q = [] // 実行したいnodeのnode-idを格納する
        this.execute_counter = 0
        this.running = false // コードを実行中かを表す.
        this.msg = undefined
        this.kernel_id = sessionStorage["kernel_id"]
        
        await this.kernelStart()

        // WebSocketで:ws/<kernel_id>に接続
        if (this.ws && this.ws.readyState != 3) {
            this.ws.close()
        }
        this.ws = new WebSocket(`ws://${window.location.host}/ws/${this.kernel_id}`)
        this.ws.onopen = () => {
            console.log("[WS] WS connecting ...")
        }
        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data)
            if (data.msg_type == "error") {
                this.execute_task_q = [this.execute_task_q[0]]
            }
            else if (data.msg_type == "exec-end-sig") {
                this.execute_task_q.shift()
                this.running = false
                if (this.execute_task_q[0]) {
                    this.running = true
                    this._executeCode()
                }
            }
            this.msg = data
        }
        this.ws.onclose = () => {
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
        const id = (kernel_id) ? kernel_id : this.kernel_id
        const res = await fetch(`${window.location.origin}/kernel/${id}`, {method: "GET"})
        if (res.ok) {
            const json = await res.json()
            console.log(`[KernelHandler] ${json.DESCR}`)
            return json.is_alive
        }
    }
    /**
     * 有効なすべてのカーネルidを取得する
     * @returns {Array}
     */
    getKernelIds = async () => {
        const res = await fetch(`${window.location.origin}/kernel`, {method: "GET"})
        if (res.ok) {
            const json = await res.json()
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
        const id = (this.kernel_id) ? this.kernel_id : ""
        const res = await fetch(`${window.location.origin}/kernel/${id}`, {method: "POST"})
        const json = await res.json()
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
        const res = await fetch(`${window.location.origin}/kernel/${this.kernel_id}/restart`,
                              {method: "POST"})
        const json = await res.json()
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
     * @param {string} kernel_id カーネルid
     */
    kernelInterrupt = async (kernel_id) => {
        const id = (kernel_id) ? kernel_id : this.kernel_id
        const res = await fetch(`${window.location.origin}/kernel/${id}/interrupt`,
                              {method: "POST"})
        const json = await res.json()
        console.log(`[KernelHandler] ${json.DESCR}`)
    }
    /**
     * node-idを実行タスクキュー(execute_task_q)に格納する
     * 
     * そのノードが既に実行待機中の場合、中断処理を行う
     * @param {string} node_id 
     */
    execute = async (node_id) => {
        // 実行したいノードが既に待機中の場合
        if (this.execute_task_q.includes(node_id)){
            await this.kernelInterrupt()
        } 
        // それ以外の場合
        else {
            this.execute_task_q.push(node_id)
            // 実行待機中のnodeが存在しない場合
            if (this.execute_task_q.length == 1) {
                this._executeCode()
            }
            // 実行待機中のnodeが他に存在する場合
            else {
                this.running = true
            }
        }
    } 
    /**
     * execute_task_qの先頭のnodeに対して実行処理を行う
     * 
     * このメソッドはインスタンスから直接呼び出さない
     */
    _executeCode = () => {
        const node_id = this.execute_task_q[0]
        const node = getNodeElement(node_id)
        node.querySelector(".return-box").innerHTML = ""
        const node_code = node.querySelector(".node-code")
        const msg = JSON.stringify({
            "code": ace.edit(node_code).getValue(),
            "node_id": node_id
        })
        this.ws.send(msg)
        this.running = true
        this.execute_counter += 1
        console.log(`[KernelHandler] Executing code (node-id=${node_id})`)
    }
}

const kh = new KernelHandler()