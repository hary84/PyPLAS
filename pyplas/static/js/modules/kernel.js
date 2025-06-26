//@ts-check
import {CodeNode} from "./nodes.js"
import * as error from "./error.js"

class KernelHandler {
    /**
     * カーネルidが有効かを調べる
     * @param {`${string}-${string}-${string}-${string}-${string}`} kernel_id 
     * @returns {Promise<boolean>} 
     */
    isAliveKernel = async (kernel_id) => {
        const res = await fetch(`${window.location.origin}/kernels/${kernel_id}`, {method: "GET"})
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
     * @param {`${string}-${string}-${string}-${string}-${string}`} kernel_id
     */
    kernelStart = async (kernel_id) => {
        const res = await fetch(`${window.location.origin}/kernels/${kernel_id}`, {method: "POST"})
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
     * @param {`${string}-${string}-${string}-${string}-${string}`} kernel_id
     */
    kernelRestart = async (kernel_id)=> {
        const res = await fetch(`${window.location.origin}/kernels/${kernel_id}/restart`,
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
     * @param {`${string}-${string}-${string}-${string}-${string}`} kernel_id
     */
    kernelInterrupt = async (kernel_id) => {
        const res = await fetch(`${window.location.origin}/kernels/${kernel_id}/interrupt`,
                              {method: "POST"})
        if (res.ok) {
            const json = await res.json()
            console.log(`[KernelHandler] ${json.DESCR}`)
        }
        else {
            throw new KernelError("Fail to interrupt kernel.")
        }
    }
}

class ExecutionHandler {
    constructor() {
        /** 実行制御するカーネルのID*/
        this.kh = new KernelHandler()
        /** 実行したいnodeのnode-idを格納するque @type {Array<string>} */
        this.execute_task_q = []
        /** 実行回数カウンタ */
        this.execute_counter = 0 
        /** コードを実行中か否か*/
        this.running = false 
        /** 受信したJSON @type {JSON | undefined} */
        this.msg = undefined
        /** 扱うカーネルのID */
        this.kernel_id = crypto.randomUUID()
    }

    initialize() {
        this.execute_task_q = []
        this.execute_counter = 0
        this.running = false 
        this.msg = undefined
    }

    /** 新規カーネルを起動し，websocketで接続する*/
    setUpKernel = async () => {
        // 変数の初期化
        this.initialize()
        this.kernel_id = crypto.randomUUID()

        if (this.ws && this.ws.readyState != 3) {
            this.ws.close(1000, "Disconnect to restart the kernel.")
        }
        await this.kh.kernelStart(this.kernel_id)
        this.connectWS()
    }

    /** すでに稼働中のカーネルを再起動し，websocketで接続する */
    restartKernel = async () => {
        this.initialize()
        if (this.ws !== undefined && this.ws.readyState != 3) {
            this.ws.close(1000, "Disconnect to restart the kernel.")
        }
        await this.kh.kernelRestart(this.kernel_id)
        this.connectWS()
    }

    /** WebSocket接続する */
    connectWS = () => {
        try {
            this.ws = new WebSocket(`ws://${window.location.host}/ws/${this.kernel_id}`)
        } catch {
            alert("WebSocket connection error!!")
            return
        }

        this.ws.onopen = () => {
            console.log("[WS] WS connecting ...")
        }
        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data)
            if (data.msg_type == "status" && data.content.execution_state == "busy") {
                this.running = true
            }
            // エラーが発生したら，待機中のノードを破棄する
            if (data.msg_type == "error") {
                if (this.execute_task_q.length > 0) {
                    this.execute_task_q = [this.execute_task_q[0]]
                }
            }
            // 終了シグナルが到達したら，キューの先頭をpopする
            // キューにnodeが残っていれば，そのノードを実行する
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
     * node-idを実行タスクキュー(execute_task_q)に格納する
     * 
     * そのノードが既に実行待機中の場合、中断処理を行う
     * @param {string} node_id 
     */
    execute = async (node_id) => {
        // 実行したいノードが既に待機中の場合，カーネルを停止する
        if (this.execute_task_q.includes(node_id)){
            await this.kh.kernelInterrupt(this.kernel_id)
        } 
        else {
            this.execute_task_q.push(node_id)
            if (this.execute_task_q.length == 1) {
                this._executeCode()
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
        this.running = true
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
        this.execute_counter += 1
        console.log(`[KernelHandler] Executing code (node-id='${node_id}')`)
    }
    /**
     * locの直下に存在する.node.codeをすべて実行する
     * @param {Element} loc 
     */
    executeAll = async (loc) => {
        await this.kh.kernelInterrupt(this.kernel_id)

        // キューがからになるまで待つ
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

const exeHandler = new ExecutionHandler()
export default exeHandler

/** KernelHandlerに関する基底エラー */
export class KernelError extends error.ApplicationError {
    /** @param {string} msg */
    constructor(msg) {
        super(msg)
    }
}
