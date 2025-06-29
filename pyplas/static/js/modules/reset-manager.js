//@ts-check

import {problem_meta} from "./helper.js"
import { QuestionNode } from "./nodes.js"
import * as Nodes  from "./nodes.js"
import * as error from "./error.js"

const container = document.querySelector("#nodesContainer")

/** 
 * ノードリセットマネージャー
 *
 * `reseter.resetNode(node)`で`CodeNode`, `QuestionNode`の入力を初期値に戻す
 */
const reseter = {
    /** problem info*/
    origin: {}, 

    /** 指定されたnodeの初期パラメータを取得する 
     * 
     * 見つからない場合, undefinedを返す  
     * 
     * **直接呼び出さない**
     * @param {string} nodeId 
     * @returns {Promise<any>}
    */
    async _getOriginParams(nodeId) {
        // originが空の場合は，APIを通じてノードの初期値を取得する
        if (Object.keys(this.origin).length == 0) {
            this.origin = await this._fetchOriginNodes()
        }
        const o = JSON.parse(this.origin.page).body
  
        // 指定したnodeIdが何番目のノードかを調べる
        const index = this._getNodeIndex(nodeId)
        return o[index]
    }, 
    /**
     * CodeNodeのcontent, QuestionNodeのconponentを初期化する
     * - `node`が`CodeNode`の場合，contentをそのまま入れ替える
     * - `node`が`QuestionNode`で，`ptype`が`0`の場合，SELECTタグのvalueを-1にし，
     * INPUTタグをクリアする
     * - `node`が`QuestionNode`で,`ptype`が`1`の場合，componentを初期化する
     * @param {Nodes.CodeNode | Nodes.QuestionNode} node 
     * @returns {Promise<void>}
     */
    async resetNode(node) {
        // 初期化するノードの初期パラメータを取得する
        const nodeParams = await this._getOriginParams(node.node_id)
        if (nodeParams === undefined) {throw new error.ApplicationError("ノードの初期値の取得に失敗しました")}

        if (node instanceof Nodes.CodeNode && nodeParams.type == Nodes.nodeType.code) {
            node.editor.setValue(nodeParams.content, -1)
        }
        else if (node instanceof QuestionNode && nodeParams.type == Nodes.nodeType.question) {
            if (node.ptype == QuestionNode.ptypes.WORDTEST) {
                node.questionField.querySelectorAll("input, select").forEach(e => {
                    // @ts-ignore eがHTMLSelectElementであることは確認済み
                    if (e.tagName == "SELECT") {e.selectedIndex=-1}
                    // @ts-ignore eがHTMLInputElementであることは確認済み
                    else if (e.tagName == "INPUT") {e.value = ""}
                })
            } else if (node.ptype == QuestionNode.ptypes.CORDTEST && node.isEditable) {
                node.answerNodes.forEach(n => {
                    n.delme()
                })
            } else if (node.ptype == QuestionNode.ptypes.CORDTEST && !node.isEditable) {
                const children = node.answerNodes
                if (children.length > nodeParams.conponent.length) {
                    throw new Nodes.NodeStructureError(node.type)
                }
                let idx = 0
                nodeParams.conponent.forEach(n => {
                    if (n.type == Nodes.nodeType.explain) {return} 
                    else if (n.type == Nodes.nodeType.code && children[idx] instanceof Nodes.CodeNode) {
                        children[idx].editor.setValue(n.content, -1)
                        idx += 1
                    }
                })
            }
        }
        else {
            throw new Nodes.NodeStructureError(node.type)
        }
        console.log(`[reset-manager] ノードの値を初期化しました(node-id=${node.node_id})`)
    },

    /** 
     * 各ノードの初期値をAPIを通して取得する  
     * 
     * **直接呼び出さない**
     * @returns {Promise<object>}
    */
    async _fetchOriginNodes() {
        const res = await fetch(`${window.location.origin}/api/probleminfo/${problem_meta.p_id}`)
        if (res.ok) {
            const json = await res.json()
            console.log(json.DESCR)
            return json 
        }
        else {
            throw new error.FetchError(res.status, res.statusText)
        }
    },

    /**
     * nodeidをもつ要素が#nodesContainer内で上から何番目かを取得する 
     * 
     * 見つからない場合-1を返す
     * 
     * **直接呼び出さない**
     * @param {string} nodeId 
     * @returns {number}
     */
    _getNodeIndex(nodeId) {
        if (container == null) {throw new Error("can not find #nodesContainer Element")}
        const nodes = container.querySelectorAll(":scope > .code, :scope > .explain, :scope >.question")
        let idx = 0
        for (const n of nodes) {
            if (n.getAttribute("data-node-id") == nodeId) {
                return idx
            }
            idx = idx + 1
        }
        return -1
    }
}

export default reseter