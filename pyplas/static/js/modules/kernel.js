//@ts-check
import {CodeNode} from "./nodes.js"
import * as error from "./error.js"

class KernelHandler {
    constructor() {
        /** 実行したいnodeのnode-idを格納するque @type {Array<string>} */
        this.execute_task_q = []
        /** 実行回数カウンター @type {number} */
        this.execute_counter = 0 
        /** コードを実行中か否か @type {boolean} */
        this.running = false 
        /** 受信したJSON @type {JSON | undefined} */
        this.msg = undefined
    }
    /**
     * インスタンス変数の初期化とカーネルの起動を行う
     * @param {boolean} alreadyExist カーネルとの新規接続か、既存の接続を再接続するか
     */
    setUpKernel = async (alreadyExist=false) => {
        this.execute_task_q = []    
        this.execute_counter = 0   
        this.running = false        
        this.msg = undefined        

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
                if (this.execute_task_q.length > 0) {
                    this.execute_task_q = [this.execute_task_q[0]]
                }
            }
            else if (data.msg_type == "exec-end-sig") {
                this.execute_task_q.shift()
                this.running = false
                if (this.execute_task_q.length > 0) {
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
     * @param {string | undefined} kernel_id 
     * @returns {Promise<boolean>} 
     */
    isAliveKernel = async (kernel_id) => {
        const id = (kernel_id) ? kernel_id : this.kernel_id
        const res = await fetch(`${window.location.origin}/kernels/${id}`, {method: "GET"})
        if (res.ok) {
            const json = await res.json()
            console.log(`[KernelHandler] ${json.DESCR}`)
            return json.is_alive
        } else {
            throw new KernelError(res.statusText)
        }

    }
    /**
     * 有効なすべてのカーネルidを取得する
     * @returns {Promise<Array>}
     */
    getKernelIds = async () => {
        const res = await fetch(`${window.location.origin}/kernels`, {method: "GET"})
        if (res.ok) {
            const json = await res.json()
            console.log(`[KernelHandler] ${json.DESCR}`)
            return json.kernel_ids
        }
        else {
            throw new KernelError(res.statusText)
        }
    }
    
    /**
     * カーネルを起動する.
     * 
     * このメソッドは直接呼び出さず、setUpKernel()からのみ呼び出す.
     */
    kernelStart = async () => {
        const id = (this.kernel_id) ? this.kernel_id : ""
        const res = await fetch(`${window.location.origin}/kernels/${id}`, {method: "POST"})
        if (res.ok) {
            const json = await res.json()
            console.log(`[Kernelhandler] ${json.DESCR}`)   
        }
        else {
            throw new KernelError(res.statusText)
        }
    }
    /**
     * REST API を用いてカーネルを再起動する
     * 
     * このメソッドは直接呼び出さず、kernelStart(), setUpKernel()からのみ呼び出す
     */
    kernelRestart = async () => {
        const res = await fetch(`${window.location.origin}/kernels/${this.kernel_id}/restart`,
                              {method: "POST"})
        if (res.ok) {
            const json = await res.json()
            console.log(`[KernelHandler] ${json.DESCR}`)
        }
        else {
            throw new KernelError(res.statusText)
        }
    }
    /**
     * REST API を用いてカーネルに中断指示を出す
     * 
     */
    kernelInterrupt = async () => {
        const res = await fetch(`${window.location.origin}/kernels/${this.kernel_id}/interrupt`,
                              {method: "POST"})
        if (res.ok) {
            const json = await res.json()
            console.log(`[KernelHandler] ${json.DESCR}`)
        }
        else {
            throw new KernelError("Fail to interrupt kernel.")
        }
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
        if (!this.ws || this.ws.readyState != 1) {
            throw new KernelError("websocket is disconnected")
        }
        if (this.execute_task_q.length == 0) {
            return
        }
        const node_id = this.execute_task_q[0]
        try {
            const node = new CodeNode(node_id)
            node.resetState()
            const msg = JSON.stringify({
                "code": node.editor.getValue(),
                "node_id": node_id
            })
            this.ws.send(msg)
        } catch (e) {
            this.execute_task_q = []
            this.running = false
            throw e
        }
        this.execute_counter  = this.execute_counter + 1
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
                        console.log("[KernelHandler] Ready for execute all")
                        resolve("kernel ready")
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
            throw new KernelError("Kernel interrupt timeout.")
        }

        try {
            loc.querySelectorAll(":scope > .node.code").forEach(e => {
                const node = new CodeNode(e)
                this.execute_task_q.push(node.nodeId)
            })
        } catch (e) {
            this.execute_task_q = []
            throw e
        }

        this._executeCode()
    }
}

const kh = new KernelHandler()
export default kh

/** KernelHandlerに関する基底エラー */
export class KernelError extends error.ApplicationError {
    /** @param {string} msg */
    constructor(msg) {
        super(msg)
    }
}
