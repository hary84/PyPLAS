//@ts-check

import {problem_meta} from "./helper.js"
import * as myclass  from "./nodes.js"
import * as error from "./error.js"

/** node reset manager */
const reseter = {
    /** problem info*/
    origin: {}, 

    /** 指定されたnodeの元データを取得する 
     * 
     * 見つからない場合, undefinedを返す
     * @param {string} nodeId 
     * @returns {Promise<any>}
    */
    async getOriginParams(nodeId) {
        if (Object.keys(this.origin).length == 0) {
            this.origin = await this._fetchOriginNodes()
        }
        const o = JSON.parse(this.origin.page).body
        const index = this._getNodeIndex(nodeId)
        return o[index]
    }, 
    /**
     * CodeNodeのcontent, QuestionNodeのconponentを初期化する
     * @param {myclass.CodeNode | myclass.QuestionNode} node 
     */
    async resetNode(node) {
        const nodeParams = await this.getOriginParams(node.nodeId)
        if (nodeParams === undefined) {throw new error.ApplicationError("Fail to get Node Object.")}
        if (node instanceof myclass.CodeNode && nodeParams.type == "code") {
            node.editor.setValue(nodeParams.content, -1)
        }
        else if (node instanceof myclass.QuestionNode && nodeParams.type == "question") {
            if (node.ptype == "0") {
                node.answerField.querySelectorAll("input, select").forEach(e => {
                    if (e.tagName == "SELECT") {e.selectedIndex=-1}
                    else if (e.tagName == "INPUT") {e.value = ""}
                })
            } else if (node.ptype == "1" && node.editable) {
                node.childNodes.forEach(n => {
                    n.delme()
                })
            } else if (node.ptype == "1" && !node.editable) {
                const children = node.childNodes
                if (children.length > nodeParams.conponent.length) {
                    throw new myclass.NodeStructureError(node.type)
                }
                let idx = 0
                nodeParams.conponent.forEach(n => {
                    if (n.type == "explain") {return} 
                    else if (n.type == "code" && children[idx] instanceof myclass.CodeNode) {
                        children[idx].editor.setValue(n.content, -1)
                        idx += 1
                    }
                })
            }
        }
        else {
            throw new myclass.NodeStructureError(node.type)
        }
        console.log(`[reset-manager] reset node(node-id=${node.nodeId})`)
    },

    /** get origin nodes string  
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
     * @param {string} nodeId 
     * @returns {number}
     */
    _getNodeIndex(nodeId) {
        const container = document.querySelector("#nodesContainer")
        if (container == null) {throw new error.ApplicationError("can not find #nodesContainer Element")}
        const nodes = container.querySelectorAll(":scope > .code, :scope > .explain, :scope >.question")
        let idx = 0
        for (const n of nodes) {
            if (n.getAttribute("node-id") == nodeId) {
                return idx
            }
            idx = idx + 1
        }
        return -1
    }
}

export default reseter