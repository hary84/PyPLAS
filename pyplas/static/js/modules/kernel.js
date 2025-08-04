//@ts-check
import {CodeNode, myNode} from "./nodes.js"
import * as error from "./error.js"

/** 
 * @class
 * カーネルの状態を制御するクラス
 */
class KernelHandler {
    /**
     * 指定したカーネルが稼働しているかを調べる
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
     * 稼働しているカーネルのIDのリストを取得する
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
     * 指定したカーネルを起動する
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
     * 指定したカーネルを再起動する
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
     * 指定したカーネル実行を中断する
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

/**
 * @class
 * カーネルでのコード実行を制御するクラス
 */
class ExecutionHandler {

    /** WebSocket メッセージタイプ */
    MSG_TYPE = {
        /** @type {"status"} */ STATUS: "status",
        /** @type {"error"} */ ERROR: "error",
        /** @type {"exec-end-sig"} */ END: "exec-end-sig"
    }

    constructor() {
        /** カーネルの状態を制御する */
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

    /** 内部パラメータを初期化する */
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
        await this.kh.kernelStart(this.kernel_id)
        this.connectWS()
    }

    /** すでに稼働中のカーネルを再起動し，websocketで接続する */
    restartKernel = async () => {
        this.initialize()
        if (this.ws !== undefined && this.ws.readyState != this.ws.CLOSED) {
            this.ws.close(1000, "Disconnect to restart the kernel.")
        }
        await this.kh.kernelRestart(this.kernel_id)
        this.connectWS()
    }

    /** WebSocket接続する */
    connectWS = () => {
        try {
            this.ws = new WebSocket(`ws://${window.location.host}/ws/${this.kernel_id}`)
        } catch (e) {
            alert("WebSocketコネクション確立中にエラーが発生しました")
            console.error(e)
            return
        }

        this.ws.onopen = () => {
            console.log("[ExecutionHandler] WebSocket接続中...")
        }
        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data)
            if (data.msg_type == this.MSG_TYPE.STATUS && data.content.execution_state == "busy") {
                this.running = true
            }
            // エラーが発生したら，待機中のノードを破棄する
            if (data.msg_type == this.MSG_TYPE.ERROR) {
                if (this.execute_task_q.length > 0) {
                    this.execute_task_q = [this.execute_task_q[0]]
                }
            }
            // 終了シグナルが到達したら，キューの先頭をpopする
            // キューにnodeが残っていれば，そのノードを実行する
            else if (data.msg_type == this.MSG_TYPE.END) {
                new CodeNode(this.execute_task_q[0]).element.dataset.runState = CodeNode.runState.COMPLETE
                this.execute_task_q.shift()
                this.running = false
                if (this.execute_task_q.length > 0) {
                    this._executeCode()
                }
            }
            this.msg = data
        }
        this.ws.onclose = () => {
            console.log("[ExecutionHandler] WebSocket切断中...")
        }
    }

    /**
     * WebSocketが正しく接続中であるかを確かめる
     * 
     * WebSocketの現在の状態は`WebSocket.readyState`の値を元に判断する
     * @throws {KernelError} 不通の場合
     * 
     * @see https://developer.mozilla.org/ja/docs/Web/API/WebSocket/readyState
     */
    WSconnectionCheck = () => {
        if (this.ws === undefined || this.ws.readyState != this.ws.OPEN) {
            throw new KernelError("WebSocketの接続が切れています")
        }
    }

    /**
     * node-idを実行タスクキュー(`execute_task_q`)に格納する
     * 
     * - そのノードが既に実行待機中の場合、カーネル実行中断処理を行う
     * - そのノードがキューの先頭の場合，実行処理を行う
     * @param {string} node_id 
     */
    execute = async (node_id) => {
        // 実行したいノードが既に待機中の場合，カーネルを中断する
        if (this.execute_task_q.includes(node_id)){
            await this.kh.kernelInterrupt(this.kernel_id)
        } 
        else {
            this.execute_task_q.push(node_id)
            if (this.execute_task_q.length == 1) {
                this._executeCode()
            }
            this.running = true
        }
    } 
    /**
     * `execute_task_q`の先頭のnodeに対して実行処理を行う
     *
     * - **このメソッドはインスタンスから直接呼び出さない**
     */
    _executeCode = () => {
        this.WSconnectionCheck()

        if (this.execute_task_q.length == 0) return

        const node_id = this.execute_task_q[0]
        this.running = true
        try {
            const node = new CodeNode(node_id)
            node.resetState()
            const msg = JSON.stringify({
                code: node.editor.getValue(),
                node_id: node_id
            })
            // @ts-ignore 接続確認済み;
            this.ws.send(msg)
        } catch (e) {
            this.execute_task_q = []
            this.running = false
            throw e
        }
        this.execute_counter += 1
        console.log(`[ExecutionHandler] コード実行中(node-id='${node_id}')`)
    }
    /**
     * locの直下に存在する`CodeNode`をすべて実行する
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
                        console.log("[ExecutionHandler] 実行準備完了")
                        resolve("kernel ready")
                    } else {
                        console.log("[ExecutionHandler] 実行待機中")
                        count ++
                        if (count > 5) {
                            clearInterval(intervalId)
                            reject()
                        }
                    }
                }, 500)
            })
        } catch (err) {
            throw new KernelError("カーネル実行中止タイムアウト")
        }

        try {
            loc.querySelectorAll(":scope > [data-node-type='code']").forEach(e => {
                const node = myNode.get(e)
                if (node !== null) {this.execute_task_q.push(node.node_id)}
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
