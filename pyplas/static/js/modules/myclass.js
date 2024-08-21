//@ts-check

import {problem_meta} from "./helper.js"
import * as error from "./error.js"

export const nodeType = {
    code: "code",
    explain: "explain",
    question: "question"
}
export const emptyNodeId = "none"

export const myNode = {
    /** active node */
    activeNode: {
        /** current active node id */ 
        node_id: emptyNodeId,
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
     * 前のNodeオブジェクトを取得する.
     * 
     * 存在しない場合nullを返す
     * @param {BaseNode} nodeObj
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
     */
    nextNode(nodeObj) {
        const e = nodeObj.nextNodeElement()
        return this.get(e)
    }
}

/** Nodeオブジェクトの基底クラス */
export class BaseNode {
    /**
     * .node[node-id]要素を指定する. 
     * nodeはnode-idとElementの両方から指定できる
     * 
     * 指定された要素がない場合NodeStructureErrorを投げる
     * @param {string | Element | any} specifier
     */
    constructor(specifier) {
        this.type = this.constructor.name
        const nodeId = specifier instanceof Element ? 
            specifier.getAttribute("node-id") ?? emptyNodeId : specifier

        const element = BaseNode.getNodeElementByNodeId(nodeId)
        if (element == null) {
            throw new NodeStructureError(this.type, "The specified Element was not found")
        }
        this.nodeId = nodeId 
        this.element = element
    }
    /**
     * node-idから対応する.nodeをもつ要素を返す.
     * node-idがnoneの場合
     * 
     * 対応する要素がない場合nullを返す
     * @param {string} nodeId 
     * @returns {Element | null}
     */
    static getNodeElementByNodeId(nodeId) {
        if (typeof nodeId !== "string") {
            throw new TypeError('nodeId must be string other than “none"')
        } else if (nodeId === emptyNodeId) {
            return null
        }
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
    /** nodeが削除可能かを調べる*/
    allowDelete = () => {
        return this.element.querySelector("[data-action='del-node']") != null
    }
    /** BaseNode.elementを削除する */
    delme = () => {
        if (!this.allowDelete()) { return }
        const nodeControl = this.element.nextElementSibling
        if (nodeControl != null && nodeControl.classList.contains("node-control")) {
            nodeControl.remove()
        }
        this.element.remove()
    }
}

export class QuestionNode extends BaseNode {
    /**
     * .node[node-id]要素を指定する. インスタンス作成時, 
     * 内部のCodeNode, ExplainNodeのAceEditorを有効化する.
     * 
     * 要素がないとき, NodeStructureErrorを投げる.
     * @param {string | Element} specifier 
     */
    constructor(specifier) {
        super(specifier)
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
        const ptype = Number(this.ptype)
        const conponent = []
        const answers = []
        let question = ""
        let editable = false 
    
        const parser = new DOMParser()
    
        // learner mode 
        if (mode == 0) {
            if (ptype == 0) {
                this.answerField.querySelectorAll("input, select").forEach(e => {
                    answers.push(e.value) // user answers
                }) 
            }
            else if (ptype == 1) {
                this.answerField.querySelectorAll(".node.code").forEach(e => {
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
                const mdString = new ExplainNode(this.answerField.querySelector("explain[node-id]") ?? emptyNodeId).editor.getValue()
                const mdDOM = parser.parseFromString(mdString, "text/html").querySelector("body")
                mdDOM.querySelectorAll("input[ans], select[ans]").forEach(e => { // currect answers
                    answers.push(e.getAttribute("ans"))
                })
                question = mdDOM.innerHTML // question
            }
            else if (ptype == 1) {
                answers.push(new CodeNode(this.element.querySelector(".test-code > .code[node-id]") ?? emptyNodeId).editor.getValue()) // answers
                question = new ExplainNode(this.element.querySelector(".question-info .explain[node-id]") ?? emptyNodeId).editor.getValue() // question
                
                editable = this.element.querySelector(".editable-flag")?.checked // editable
                if (!editable) { // conponent
                    this.answerField.querySelectorAll(".node").forEach(e => {
                        const n = myNode.get(e)
                        if (n instanceof ExplainNode) {
                            conponent.push({
                                "type": nodeType.explain,
                                "content": n.editor.getValue()
                            })
                        }
                        else if (n instanceof CodeNode) {
                            const param = n.extractCodeParams()
                            conponent.push({
                                "type": nodeType.code,
                                "content": param.content,
                                "readonly": param.readonly
                            })
                        }
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
    /** 解答の採点を行う */
    scoring = async () => {

        const params = this.extractQuestionParams(0)
        this._showProgressBar()
        const res = await fetch(`${window.location.origin}/problems/${problem_meta.p_id}/scoring`, {
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
            const json = await res.json()
            console.log(`[scoring] ${json.DESCR}`)
            this.element.setAttribute("progress", json.progress)
            this._renderToast(json.content)
            const questionNav = document.querySelector(`#question-nav a[href='#q-id-${params.q_id}']`)
            questionNav?.setAttribute("progress", json.progress)
            this._hideProgressBar()
        }
        else if (res.ok && res.status == 202) {}
        else { 
            this._hideProgressBar()
            throw new error.FetchError(res.status, res.statusText)
        }
    }
    _renderToast = (content) => {
        const toast = this.element.querySelector(".for-toast > .toast")
        const toastBody = this.element.querySelector(".for-toast > .toast > .toast-body")
        if (toastBody == null) {throw new NodeStructureError(this.type)}
        toastBody.innerHTML = content 
        toast?.classList.add("show")
    }
    _showProgressBar = () => {
        const progressBar = this.element.querySelector(".progress")
        if (progressBar == null) {throw new NodeStructureError(this.type)}
        progressBar.classList.remove("d-none")
    }
    _hideProgressBar = () => {
        const progressBar = this.element.querySelector(".progress")
        if (progressBar == null) {throw new NodeStructureError(this.type)}
        progressBar.classList.add("d-none")
    }
    /** 採点のキャンセル */
    canceling = async () => {
        const res = await fetch(`${window.location.origin}/problems/${problem_meta.p_id}/cancel?kernel_id=${this.nodeId}`, {
            method: "POST",
        })
        if (res.ok) {
            const json = await res.json()
            console.log(json.DESCR)
        }
        else { throw new error.FetchError(res.status, res.statusText) }
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
     * ExplainNode, CodeNodeの親クラス
     * @param {string | Element} specifier 
     */
    constructor(specifier) {
        super(specifier) 
        const hasAce = this.element.querySelector(".ace_text-input") != null
        if (!hasAce) {this.register()}
    }
    get editor() {
        return ace.edit(this.element.querySelector(".node-code, .node-mde"))
    }
    /** ace editorを有効化する */
    register = () => {
        if (this.element.classList.contains("code")) {
            this._registerAcePythonEditor()
        } 
        else if (this.element.classList.contains("explain")) {
            this._registerAceMDE()
        }
    }
    _registerAcePythonEditor = () => {
        const defaultLineNumbers = 5
        const maxLines = 25
        
        const editableElem = this.element.querySelector(".node-code")
        if (editableElem == null) {throw new NodeStructureError("CodeNode")}

        const editor = ace.edit(editableElem, {
            mode: "ace/mode/python",
            theme: "ace/theme/cloud_editor_dark",
            fontSize: "0.9rem",
            showPrintMargin: false,
            maxLines: maxLines,
            // minLines: defaultLineNumbers,
            readOnly: editableElem.classList.contains("readonly")
        });
        editor.container.childNodes[0].tabIndex = -1
    }
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
        const parent = this.element.closest(".question.node")
        if (parent) {return new QuestionNode(parent)}
        return null
    } 
}
export class CodeNode extends EditorNode {
    /**
     * ace editorを持ったCodeNodeオブジェクトを作成する 
     * 
     * .code.node[kernel-id]がない場合，NodeStructureErrorを投げる
     * @param {string | Element | any} specifier 
     */
    constructor(specifier) {
        super(specifier)
    }

    /**  Codeインスタンスのパラメータを返す */
    extractCodeParams = () => {
        const content = this.editor.getValue()
        const readonlyFlag = this.element.querySelector(".readonly-flag")
        const readonly = (readonlyFlag != null) ? readonlyFlag.checked : false
        return {
            "content": content,
            "readonly": readonly
        }
    }
    /** Codeインスタンスの実行状態を初期化する */
    resetState = () => {
        const returnBox = this.element.querySelector(".return-box")
        if (returnBox == null) {throw new NodeStructureError(this.type)}
        returnBox.innerHTML = ""
        this.element.querySelector(".node-side")?.classList.remove("bg-success-subtle")
    }
}

export class ExplainNode extends EditorNode {
    /**
     * ace editorを持ったExplainNodeオブジェクトを作成する
     * 
     * .explain.node[kernel-id]がない場合，NodeStructureErrorを投げる
     * @param {string | Element} specifier 
     */
    constructor(specifier) {
        super(specifier)
    }
    /** コードをhighlight.jsでハイライトする */
    highlighlting = () => {
        this.element.querySelectorAll("pre code").forEach(e => {
            hljs.highlightBlock(e)
        })
    }
    /** previewを表示する */
    showPreview = () => {
        const html = marked.parse(this.editor.getValue())
        const preview = this.element.querySelector(".for-preview")
        const mde = this.element.querySelector(".mde")
        if (mde == null || preview == null) {
            throw new NodeStructureError(this.type)
        }
        preview.innerHTML = html 
        mde.classList.add("preview-active")
    }
    showEditor = () => {
        const mde = this.element.querySelector(".mde")
        if (mde === null) {throw new NodeStructureError(this.type)}
        mde.classList.remove("preview-active")
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
            '<input type="text" class="form-control" placeholder="answer" ans=?????>',
        ].join("\n")
        this.editor.insert(tag)
    }
    addSelectionProblem = () => {
        const tag = [
        '<select class="form-select" ans=?????>',
        '  <option> Open this select menu</option>',
        '  <option value="1">?????</option>',
        '  <option value="2">?????</option>',
        '</select>'
        ].join("\n")
        this.editor.insert(tag)
    }
}

/** Nodeに関する基底エラー */
export class NodeError extends error.ApplicationError {
    /**@param {string} msg */
    constructor(msg) {
        super(msg)
    }
}
/** Node内の要素が存在しない際のエラー */
export class NodeStructureError extends NodeError {
    /**
     * @param {string} nodeType
     * @param {string} msg
     */
    constructor(nodeType, msg=`Invalid node structure in ${nodeType} node`) {
        super(`[${nodeType}] ${msg}`)
        this.nodeType = nodeType
    }
}
