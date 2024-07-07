//@ts-check

import {p_id} from "./utils.js"

export const myNode = {
    /** active node */
    activeNode: {
        /** current active node id */ 
        node_id: "",
        /** get current active node object */
        get() {
            return myNode.get(this.node_id)
        }
    },
    /**
     * node-idもしくはelementをうけとり、対応するNodeオブジェクトを返す. 
     * 
     * 対応するNodeオブジェクトが見つからない場合, nullを返す
     * @param {string | Element | BaseNode | any} specifier 
     * @returns {CodeNode | ExplainNode | QuestionNode | null}
     */
    get(specifier) {
        if (typeof specifier == "string") {
            return this._getNodeObjectByNodeId(specifier)
        }
        else if (specifier instanceof Element) {
            return this._getNodeObjectByElem(specifier)
        }
        else if (specifier instanceof BaseNode) {
            return this._getNodeObjectByElem(specifier.element)
        }
        else {
            return null
        }
    },
    /**
     * specifierからcode nodeを明示して取得する. 
     * 
     * 対応していない場合NodeErrorを投げる
     * @param {string | Element} specifier 
     * @returns {CodeNode}
     */
    code(specifier) {
        const n = this.get(specifier)
        if (n instanceof CodeNode) {
            return n
        }
        else {
            throw new NodeError("can not get CodeNode from specifier.")
        }
    },
    /**
     * specifierからexplain nodeを明示して取得する. 
     * 
     * 対応していない場合NodeErrorを投げる
     * @param {string | Element} specifier 
     * @returns {ExplainNode}
     */
    explain(specifier) {
        const n = this.get(specifier)
        if (n instanceof ExplainNode) {
            return n 
        } 
        else {
            throw new NodeError("can not get Explain Node from specifier.")
        }
    },
    /**
     * specifierからquestion nodeを明示して取得する. 
     * 
     * 対応していない場合NodeErrorを投げる
     * @param {string | Element} specifier 
     * @returns {QuestionNode}
     */
    question(specifier) {
        const n = this.get(specifier)
        if (n instanceof QuestionNode) {
            return n
        }
        else {
            throw new NodeError("can not get Question Node from specifier.")
        }
    },
    /**
     * elementからNodeオブジェクトを取得する
     * 
     * 対応するNodeがない場合, nullを返す
     * @param {Element} e
     * @returns {CodeNode | ExplainNode | QuestionNode | null}
     */
    _getNodeObjectByElem(e) {
        try {
            if (e.classList.contains("code")) {
                return new CodeNode(e)
            }
            else if (e.classList.contains("explain")) {
                return new ExplainNode(e)
            }
            else if (e.classList.contains("question")) {
                return new QuestionNode(e)
            }
            else {
                return null
            }
        } catch {
            return null
        }
    },
    /**
     * node-idからNodeオブジェクトを取得する
     * 
     * 対応するNodeがない場合, nullを返す
     * @param {string} nodeId
     * @returns {CodeNode | ExplainNode | QuestionNode | null}
     */
    _getNodeObjectByNodeId(nodeId) {
        const e = BaseNode.getNodeElementByNodeId(nodeId)
        if (!e) {return null}
        return this._getNodeObjectByElem(e)
    },
    /**
     * 前のNodeオブジェクトを取得する.
     * 
     * 存在しない場合nullを返す
     * @param {BaseNode} nodeObj
     * @returns {BaseNode | null}
     */
    prevNode(nodeObj) {
        const e = nodeObj.prevNodeElement()
        return this.get(e)
    },
    /**
     * 次のNodeオブジェクトを取得する. 
     * 
     * 存在しない場合nullを返す.
     * @param {BaseNode} nodeObj
     * @returns {BaseNode | null}
     */
    nextNode(nodeObj) {
        const e = nodeObj.nextNodeElement()
        return this.get(e)
    }
}

/**
 * Nodeオブジェクトの基底クラス
 */
export class BaseNode {
    /**
     * node-idとそれに対応するelementをメンバ変数に格納する. 
     * 
     * node-idがないもしくは, .nodeクラスが無い場合NodeStructureErrorを発生させる.
     * @param {string | Element} specifier
     */
    constructor(specifier) {
        this.type = this.constructor.name 
        if (typeof specifier == "string") {
            const e = BaseNode.getNodeElementByNodeId(specifier)
            if (e === null) {throw new NodeStructureError(this.type)}
            this.nodeId = specifier
            this.element = e
        }
        else if (specifier instanceof Element) {
            const nodeId = specifier.getAttribute("node-id")
            if (!specifier.classList.contains("node") || !nodeId) {
                throw new NodeStructureError(this.type)
            }
            this.nodeId = nodeId
            this.element = specifier
        } else {
            throw new TypeError("invalid argument 'specifier'")
        }
    }
    /**
     * node-idから対応する.nodeをもつ要素を返す
     * 
     * 対応する要素がない場合nullを返す
     * @param {string} nodeId 
     * @returns {Element | null}
     */
    static getNodeElementByNodeId(nodeId) {
        return document.querySelector(`div.node[node-id="${nodeId}"]`)
    }
    /**
     * 次の.node[node-id]を持つ要素を返す
     * @returns {Element | null}
     */
    nextNodeElement = () => {
        let sibling = this.element.nextElementSibling
        while (sibling) {
            if (sibling.getAttribute("node-id") && sibling.classList.contains("node")) {
                return sibling
            }
            sibling = sibling.nextElementSibling 
        }
        return null
    }
    /**
     * 前のNodeオブジェクトを返す
     * @returns {Element | null}
     */
    prevNodeElement = () => {
        let sibling = this.element.previousElementSibling
        while (sibling) {
            if (sibling.getAttribute("node-id") && sibling.classList.contains("node")) {
                return sibling
            }
            sibling = sibling.previousElementSibling
        }
        return null
    }
    /**
     * nodeが削除可能かを調べる
     * @returns {boolean}
     */
    allowDelete = () => {
        return !!this.element.querySelector(".btn-delme")
    }
    /**
     * BaseNode.elementを削除する
     */
    delme = () => {
        if (!this.allowDelete()) { return }
        const nodeControl = this.element.nextElementSibling
        if (nodeControl && nodeControl.classList.contains("node-control")) {
            nodeControl.remove()
        }
        this.element.remove()
    }
}

export class QuestionNode extends BaseNode {
    /**
     * 内部のEditorNodeのace editorを有効化したQuestionNodeオブジェクトを返す
     * 
     * class属性にquestionがないとき, NodeStructureErrorを発生させる.
     * @param {string | Element} specifier 
     */
    constructor(specifier) {
        super(specifier)
        if (!this.element.classList.contains("question")) {
            throw new NodeStructureError(this.type)
        }
        this.element.querySelectorAll(".node.code, .node.explain").forEach(e => {
            new EditorNode(e)
        })
        this.qId = this.element.getAttribute("q-id")
    }
    get ptype() {
        return this.element.getAttribute("ptype")
    }
    get editable() {
        return this.element.classList.contains("editable")
    }
    get answerField() {
        const c = this.element.querySelector(".answer-content")
        if (c === null) {throw new NodeStructureError(this.type)}
        return c
    }
    /**
     * Questionインスタンスのパラメータを返す
     * @param {number} mode 
     * @returns {object}
     */
    extractQuestionParams = (mode) => {
        const node_id = this.nodeId
        const q_id = this.qId
        const ptype = Number(this.element.getAttribute("ptype"))
        const conponent = []
        const answers = []
        let question = ""
        let editable = false 
    
        const parser = new DOMParser()
        const answerContent = this.answerField
    
        // learner mode 
        if (mode == 0) {
            if (ptype == 0) {
                answerContent.querySelectorAll(".q-text > input, .q-text > select").forEach(e => {
                    answers.push(e.value) // user answers
                }) 
            }
            else if (ptype == 1) {
                answerContent.querySelectorAll(".node.code").forEach(e => {
                    const codeNode = new CodeNode(e)
                    answers.push(codeNode.editor.getValue()) // user answers
                })
            }
            return {
                "node_id": node_id, // str
                "q_id": q_id,       // str
                "ptype": ptype,     // int 
                "answers": answers  // list
            }
        }
    
        // creator mode 
        if (mode == 1) {
            if (ptype == 0) {
                const md_string = new ExplainNode(answerContent.querySelector(".node.explain")).editor.getValue()
                const md_dom = parser.parseFromString(md_string, "text/html").querySelector("body")
                md_dom.querySelectorAll(".q-text > input[ans], .q-text > select[ans]").forEach(e => { // currect answers
                    answers.push(e.getAttribute("ans"))
                })
                question = md_dom.innerHTML // question
            }
            else if (ptype == 1) {
                answers.push(new CodeNode(this.element.querySelector(".test-code > .node.code")).editor.getValue()) // answers
                question = new ExplainNode(this.element.querySelector(".question-info .node.explain")).editor.getValue() // question
                
                editable = this.element.querySelector(".editable-flag").checked // editable
                if (!editable) { // conponent
                    answerContent.querySelectorAll(".node").forEach(e => {
                        if (e.classList.contains("explain")) {
                            var type = "explain"
                            var content = new ExplainNode(e).editor.getValue()
                        }
                        else if (e.classList.contains("code")) {
                            var type = "code"
                            var content = new CodeNode(e).editor.getValue()
                        }
                        conponent.push({"type": type, "content": content})
                    })
                }
            }
            return {
                "node_id": node_id,     // str
                "q_id": q_id,           // str
                "ptype": ptype,         // int 
                "conponent": conponent, // list
                "question": question,   // str
                "editable": editable,   // bool
                "answers": answers      // list
            }
        }
    }
    /**
     * 解答の採点を行う
     */
    scoring = async () => {
        const toast = this.element.querySelector(".for-toast > .toast")
        const progress = this.element.querySelector(".progress")
        const params = this.extractQuestionParams(0)
        if (toast === null || progress === null) {throw new NodeStructureError(this.type)}

        // toast.classList.remove("show")
        progress.classList.remove("d-none")
        const res = await fetch(`${window.location.origin}/problems/${p_id}/scoring`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                "q_id": params.q_id,
                "ptype": params.ptype,
                "answers": params.answers, 
                "kernel_id": this.nodeId
            })
        })
        
        if (res.ok && res.status == 200) {
            progress.classList.add("d-none")
            const json = await res.json()
            console.log(`[scoring] ${json.DESCR}`)
            this.element.setAttribute("progress", json.progress)
            try {
                toast.querySelector(".toast-body").innerHTML = json.content
                document.querySelector(`#question-nav a[href='#q-id-${params.q_id}']`).setAttribute("progress", json.progress)
            } catch(e) {
                if (e instanceof TypeError) {throw new NodeStructureError(this.type)}
            }
            toast.classList.add("show")
        }
        else if (res.ok && res.status == 202) {

        }
        else {
            progress.classList.add("d-none")
            throw new FetchError(res.status, res.statusText)
        }
    }
    /**
     * 採点のキャンセル
     */
    canceling = async () => {
        const res = await fetch(`${window.location.origin}/problems/${p_id}/cancel?kernel_id=${this.nodeId}`, {
            method: "POST",
        })
        if (res.ok) {
            const json = await res.json()
            console.log(json.DESCR)
        }
        else {
            throw new FetchError(res.status, res.statusText)
        }
    }

    /**
     * 内部に存在するEditorNodeのリストを返す
     * @returns {Array<EditorNode>}
     */
    get childNodes () {
        const nodeList = []
        this.element.querySelectorAll(".answer-content > .node[node-id]").forEach(e => {
            if (e.classList.contains("code")) {
                nodeList.push(new CodeNode(e))
            }else if (e.classList.contains("explain")) {
                nodeList.push(new ExplainNode(e))
            }
        }) 
        return nodeList
    }
}

export class EditorNode extends BaseNode {
    /**
     * Ace editorを有効化したEditorNodeオブジェクトを返す. 
     * @param {string | Element} specifier 
     */
    constructor(specifier) {
        super(specifier) 
        const hasAce = !!this.element.querySelector(".ace_text-input")
        if (this.element.classList.contains("code")) {
            if (!hasAce) {this._registerAcePythonEditor()}
        }
        else if (this.element.classList.contains("explain")) {
            if (!hasAce) {this._registerAceMDE()}
        }
        else {
            throw new NodeStructureError(this.type)
        }
    }
    /**
     * ace editorオブジェクトを返す
     */
    get editor() {
        return ace.edit(this.element.querySelector(".node-code, .node-mde"))
    }
    /**
     * Python ace editorを有効化する
     */
    _registerAcePythonEditor = () => {
        const defaultLineNumbers = 5
        const maxLines = 25
        
        const editableElem = this.element.querySelector(".node-code")
        if (editableElem === null) {throw new NodeStructureError("CodeNode")}

        const editor = ace.edit(editableElem, {
            mode: "ace/mode/python",
            theme: "ace/theme/cloud_editor_dark",
            fontSize: "0.9rem",
            showPrintMargin: false,
            maxLines: maxLines,
            minLines: defaultLineNumbers,
            readOnly: editableElem.classList.contains("readonly")
        });
        editor.container.childNodes[0].tabIndex = -1
    }
    /**
     * Markdown ace editorを有効化する
     */
    _registerAceMDE = () => {
        const defaultLineNumbers = 5
        const maxLines = 40
    
        const editableElem = this.element.querySelector(".node-mde")
        if (editableElem === null) {throw new NodeStructureError("ExplainNode")}
    
        const editor = ace.edit(editableElem, {
            mode: "ace/mode/markdown",
            theme: "ace/theme/sql_server",
            fontSize: "1rem",
            showGutter: false,
            highlightActiveLine: false,
            maxLines: maxLines,
            minLines: defaultLineNumbers
        })
        editor.container.childNodes[0].tabIndex = -1
    }

    /**
     * EditorNodeがQuestionNodeの内部にある場合, そのQuestionNodeのオブジェクトを返す.
     * 
     * 存在しない場合はnullを返す
     * @returns {QuestionNode | null}
     */
    get parentQuestionNode() {
        const parent = this.element.closest(".question")
        if (parent) {return new QuestionNode(parent)}
        return null
    } 
}
export class CodeNode extends EditorNode {
    /**
     * ace editorを持ったCodeNodeオブジェクトを作成する
     * @param {string | Element} specifier 
     */
    constructor(specifier) {
        super(specifier)
    }
    /**
     * Codeインスタンスのパラメータを返す
     */
    extractCodeParams = () => {
        const content = this.editor.getValue()
        const readonlyFlag = this.element.querySelector(".readonly-flag")
        const readonly = (!!readonlyFlag) ? readonlyFlag.checked : false
        return {
            "content": content,
            "readonly": readonly
        }
    }
    /**
     * Codeインスタンスの実行状態を初期化する
     */
    resetState = () => {
        try {
            this.element.querySelector(".return-box").innerHTML = ""
            this.element.querySelector(".node-side").classList.remove("bg-success-subtle")
        } catch (e) {
            throw new NodeStructureError(this.type)
        }
    }

}

export class ExplainNode extends EditorNode {
    /**
     * ace editorを持ったExplainNodeオブジェクトを作成する
     * @param {string | Element} specifier 
     */
    constructor(specifier) {
        super(specifier)
    }
    /**
     * コードをhighlight.jsでハイライトする
     */
    highlighlting = () => {
        this.element.querySelectorAll("pre code").forEach(e => {
            hljs.highlightBlock(e)
        })
    }
    /**
     * previewを表示する
     */
    showPreview = () => {
        const html = marked.parse(this.editor.getValue())
        const preview = this.element.querySelector(".for-preview")
        try {
            preview.innerHTML = html 
            this.highlighlting()
            this.element.querySelector(".mde").classList.add("preview-active")

        } catch (e) {
            if (e instanceof TypeError) {throw new NodeStructureError(this.type)}
        }
    }
    showEditor = () => {
        try {
            this.element.querySelector(".mde").classList.remove("preview-active")
        } catch {
            throw new NodeStructureError(this.type)
        }
    }
    embedBold = () => {
        this.editor.insert(`**${this.editor.getCopyText()}**`)
    }
    embedItalic = () => {
        this.editor.insert(`*${this.editor.getCopyText()}*`)
    }
    embedLink = () => {
        this.editor.insert("[](http:~)")
    }
    embedImg = () => {
        this.editor.insert("<p><img src='/static/img/ ' alt=''/></p>")
    }
    addFillInBlankProblem = () => {
        const tag = [
            '<p class="mb-0 q-text">',
            '   <label class="form-label">?????</label>',
            '   <input type="text" class="form-control" placeholder="answer" ans=?????>',
            '</p>'
        ].join("\n")
        this.editor.insert(tag)
    }
    addSelectionProblem = () => {
        const tag = [
            '<!--  question  -->',
            '<p class="mb-0 q-text">',
            '   <label class="form-label">?????</label>',
            '   <select class="form-select" ans=?????>',
            '       <option> Open this select menu</option>',
            '       <option value="1">?????</option>',
            '       <option value="2">?????</option>',
            '   </select>',
            '</p>',
        ].join("\n")
        this.editor.insert(tag)
    }
}
/** 基底エラー */
export class ApplicationError extends Error {
    /** @param {string} msg */
    constructor(msg) {
        super(msg)
        this.name = this.constructor.name
    }
}
/** fetch api に関するエラー*/
export class FetchError extends ApplicationError {
    /** 
     * @param {number} statusCode 
     * @param {string} statusText
    */
    constructor(statusCode, statusText) {
        super(`${statusCode} - ${statusText}`)
        this.statusCode = statusCode
        this.statusText = statusText
    }
}
/** KernelHandlerに関する基底エラー */
export class KernelError extends ApplicationError {
    /** @param {string} msg */
    constructor(msg) {
        super(msg)
    }
}
/** Nodeに関する基底エラー */
export class NodeError extends ApplicationError {
    /**@param {string} msg */
    constructor(msg) {
        super(msg)
    }
}
/** Node内の要素が存在しない際のエラー */
export class NodeStructureError extends NodeError {
    /**@param {string} nodeType */
    constructor(nodeType) {
        super(`Invalid node structure in ${nodeType} node.\n Reload page.`)
        this.nodeType = nodeType
    }
}
