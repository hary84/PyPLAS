// import {p_id} from "./utils"
// import {myNode} from "./myclass."

/** node reset manager */
const reseter = {
    /** problem info*/
    origin: undefined, 

    /** 指定されたnodeの元データを取得する 
     * @param {string} nodeId 
     * @returns {Promise<object> | Promise<undefined>}
    */
    async getOriginParams(nodeId) {
        if (this.origin === undefined) {
            this.origin = await this._getOriginNodes()
        }
        const o = JSON.parse(this.origin.page).body
        const index = this._getNodeIndex(nodeId)
        return o[index]
    }, 
    /**
     * CodeNodeのcontent, QuestionNodeのconponentを初期化する
     * @param {BaseNode} node 
     * @returns {null}
     */
    async resetNode(node) {
        const nodeParams = await this.getOriginParams(node.nodeId)
        if (!nodeParams) {throw new ApplicationError("Nodeの取得に失敗しました")}
        if (node instanceof CodeNode && nodeParams.type == "code") {
            node.editor.setValue(nodeParams.content, -1)
        }
        else if (node instanceof QuestionNode && nodeParams.type == "question") {
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
                    throw new NodeStructureError(node.type)
                }
                let idx = 0
                nodeParams.conponent.forEach(n => {
                    if (n.type == "explain") {return} 
                    else if (n.type == "code") {
                        children[idx].editor.setValue(n.content, -1)
                        idx += 1
                    }
                })
            }
        }
        else {
            throw new NodeStructureError(node.type)
        }
    },

    /** get origin nodes string  
     * @returns {Promise<object>}
    */
    async _getOriginNodes() {
        try {
            const res = await fetch(`${window.location.origin}/problems/${p_id}/info`, {
                method: "GET"
            })
            const json = await res.json()
            if (res.ok) {
                console.log(json.DESCR)
                return json
            }
            else {
                alert(`データの取得に失敗しました\n ${res.url}`)
                throw new ApplicationError(json.DESCR)
            }
        }
        catch (e) {
            console.error(e)
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