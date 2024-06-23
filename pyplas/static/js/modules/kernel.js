
class KernelHandler {
    /**
     * インスタンス変数の初期化とカーネルの起動を行う
     * @param {boolean} alreadyExist カーネルとの新規接続か、既存の接続を再接続するか
     */
    setUpKernel = async (alreadyExist=false) => {
        this.execute_task_q = []    // 実行したいnodeのnode-idを格納する
        this.execute_counter = 0    // 実行回数カウンター
        this.running = false        // コードを実行中かを表す
        this.msg = undefined        // ipykernelから受信したJSONを格納する

        if (this.ws && this.ws.readyState != 3) {
            this.ws.close(1000, "Disconnect to restart the kernel.")
        }
        
        if (alreadyExist) {
            await this.kernelRestart()
            
        } else {
            this.kernel_id = crypto.randomUUID()
            await this.kernelStart()
        }
        
        // WebSocketで:ws/<kernel_id>に接続
        this.ws = new WebSocket(`ws://${window.location.host}/ws/${this.kernel_id}`)
        this.ws.onopen = () => {
            console.log("[WS] WS connecting ...")
        }
        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data)
            if (data.msg_type == "status" && data.content.execution_state == "busy") {
                this.running = true
            }
            if (data.msg_type == "error") {
                this.execute_task_q = [this.execute_task_q[0]]
            }
            else if (data.msg_type == "exec-end-sig") {
                this.execute_task_q.shift()
                this.running = false
                if (this.execute_task_q[0]) {
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
     * 
     * このメソッドは直接呼び出さず、setUpKernel()からのみ呼び出す.
     */
    kernelStart = async () => {
        const id = (this.kernel_id) ? this.kernel_id : ""
        const res = await fetch(`${window.location.origin}/kernel/${id}`, {method: "POST"})
        const json = await res.json()
        console.log(`[Kernelhandler] ${json.DESCR}`)   
        if (!res.ok) {
            alert("Failed to start kernel.\nPlease restart the server.")
            throw new Error("Failed to start new kernel.")
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
        if (!res.ok) {
            alert("Failed to restart kernel.\nPlease restart the server.")
            throw new Error("Failed to restart kernel.")
        }
    }
    /**
     * REST API を用いてカーネルに中断指示を出す
     * 
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
        if (this.execute_task_q.length == 0) {
            return
        }
        const node_id = this.execute_task_q[0]
        const node = getNodeObjectByNodeId(node_id)
        node.element.querySelector(".return-box").innerHTML = ""
        const msg = JSON.stringify({
            "code": node.editor.getValue(),
            "node_id": node_id
        })
        this.ws.send(msg)
        this.execute_counter += 1
        console.log(`[KernelHandler] Executing code (node-id='${node_id}')`)
    }
    /**
     * locの直下に存在する.node.codeをすべて実行する
     * @param {Element} loc 
     */
    executeAll = async (loc) => {
        await this.kernelInterrupt()

        let count = 0
        try {
            await new Promise((resolve, reject) => {
                const intervalId = setInterval(()=> {
                    if (this.execute_task_q.length == 0 && this.running == false) {
                        clearInterval(intervalId)
                        console.log("[KernelHandler] Ready for execute all!")
                        resolve()
                    } else {
                        console.log("[KernelHandler] Wait for execute all.")
                        count ++
                        if (count > 5) {
                            clearInterval(intervalId)
                            reject()
                        }
                    }
                }, 500)
            })
        } catch (err) {
            alert("Execute Timeout")
            return 
        }

        loc.querySelectorAll(":scope > .node.code").forEach(elem => {
            const node_id = elem.getAttribute("node-id")
            this.execute_task_q.push(node_id)
        })

        this._executeCode()
    }
}

const kh = new KernelHandler()