//@ts-check

import {problem_meta, notNull} from "./helper.js"
import * as error from "./error.js"

export const nodeType = {
    code: "code",
    explain: "explain",
    question: "question"
}
export const runState = {
    idle: "idle",
    queued: "queued",
    running: "running",
}

export const emptyNodeId = "none"

/**
 * @typedef QuestionNodeParams
 * @type {object}
 * @property {string} node_id
 * @property {string} q_id
 * @property {number} ptype
 * @property {Array=}  conponent
 * @property {string=} question
 * @property {boolean=} editable
 * @property {Array} answers
 * @property {Array=} explanations
 */

export const myNode = {
    /** active node */
    activeNode: {
        /** current active node id */ 
        node_id: undefined,
        /** get current active node object */
        get() {
            return myNode.get(this.node_id?? emptyNodeId)
        }
    },
    /**
     * node-idもしくはelementをうけとり、対応するNodeオブジェクトを返す. 
     * 
     * 対応するNodeオブジェクトが見つからない場合, nullを返す
     * @param {string | Element | BaseNode} specifier 
     */
    get(specifier) {
        if (typeof specifier == "string") {
            const e = BaseNode.getNodeElementByNodeId(specifier)
            if (e === null) {return null}
            return this._getNodeObjectByElem(e)
        }
        else if (specifier instanceof Element) {
            return this._getNodeObjectByElem(specifier)
        }
        else if (specifier instanceof BaseNode) {
            return this._getNodeObjectByElem(specifier.element)
        }
        else {
            throw new TypeError("argument 'specifier' must be string or Element or BaseNode")
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
    },
    /**
     * 前のNodeオブジェクトを取得する.
     * 
     * 存在しない場合nullを返す
     * @param {BaseNode} nodeObj
     */
    prevNode(nodeObj) {
        const e = nodeObj.prevNodeElement() ?? emptyNodeId
        return this.get(e)
    },
    /**
     * 次のNodeオブジェクトを取得する. 
     * 
     * 存在しない場合nullを返す.
     * @param {BaseNode} nodeObj
     */
    nextNode(nodeObj) {
        const e = nodeObj.nextNodeElement() ?? emptyNodeId
        return this.get(e)
    }
}

/** Nodeオブジェクトの基底クラス */
export class BaseNode {
    /**
     * BaseNodeオブジェクトを作成する．  
     * BaseNodeオブジェクトは，data-role='node'かつ指定したdata-node-idを持つ要素で構成される
     * 
     * 指定された要素がない場合NodeStructureErrorを投げる
     * @param {string} node_id
     */
    constructor(node_id) {
        this.type = this.constructor.name
        const element = notNull(BaseNode.getNodeElementByNodeId(node_id), new NodeError("指定したnode-idを持つ要素は存在しません"))
        this.nodeId = notNull(element.dataset.nodeId, new NodeError("node-idが存在しません"))
        this.element = element
    }
    /**
     * node-idから対応する.nodeをもつ要素を返す.
     * @param {string} node_id 
     * @returns {HTMLElement | null}
     */
    static getNodeElementByNodeId(node_id) {
        return document.querySelector(`div[data-role="node"][data-node-id="${node_id}"]`)
    }
    /**要素がBaseNodeの条件に合うか確かめる
    * @param {Element} e 
    * @returns {boolean} */
    isNode(e) {
        return e.getAttribute("data-node-id") !== null && e.getAttribute("data-role") == "node"
    }
    /**
     * 次の.node[node-id]を持つ要素を返す
     * @returns {Element | null}
     */
    nextNodeElement () {
        let sibling = this.element.nextElementSibling
        while (sibling) {
            if (this.isNode(sibling)) {
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
    prevNodeElement () {
        let sibling = this.element.previousElementSibling
        while (sibling) {
            if (this.isNode(sibling)) {
                return sibling
            }
            sibling = sibling.previousElementSibling
        }
        return null
    }
    /** nodeが削除可能かを調べる*/
    allowDelete () {
        const nodeConfig = notNull(this.element.dataset.nodeConfig)
        return JSON.parse(nodeConfig).allow_del
    }
    /** BaseNode.elementを削除する */
    delme() {
        if (this.allowDelete()) {
            const nodeControl = this.element.nextElementSibling
            if (nodeControl != null && nodeControl.getAttribute("data-role") == "node-control") {
                nodeControl.remove()
            }
            this.element.remove()
        }
    }
}

export class QuestionNode extends BaseNode {
    /**
     * BaseNodeの制約に加えて，
     * - `data-node-type` = 'question'
     * - `data-q-id`
     * - `data-q-ptype`  
     * を持つ要素を下に作成する
     * 
     * 要素がないとき, NodeStructureErrorを投げる.
     * @param {string} node_id
     */
    constructor(node_id) {
        super(node_id)
        const dataset = this.element.dataset
        this.qId = notNull(dataset.qId, new NodeStructureError(this.type))
        this.ptype = notNull(dataset.qPtype, new NodeStructureError(this.type))
        this.activate()
    }

    get answerField() {
        const c = this.element.querySelector("[data-role='answer-field']")
        if (c === null) {throw new NodeStructureError(this.type)}
        return c
    }

    get questionField() {
        const c = this.element.querySelector("[data-role='question-field']")
        if (c === null) {throw new NodeStructureError(this.type)}
        return c
    }

    /**QuestionNode内のEditorNodeのace editorを有効化する*/
    activate = () => {
        this.element.querySelectorAll("[data-role='node']").forEach(e => {
            const dataset = e.dataset 
            if (dataset.nodeType == nodeType.code) {new CodeNode(dataset.nodeId)}
            else if (dataset.nodeType == nodeType.explain) {new ExplainNode(dataset.nodeId)}
        })
    }
    /**
     * Questionインスタンスのパラメータを返す
     * @param {0 | 1} mode 0: leaner, 1: creator
     * @returns {QuestionNodeParams}
     */
    extractQuestionParams (mode) {
        const ptype = Number(this.ptype)
        const conponent = []
        const answers = []
        let question = ""
        let editable = false 
        const explanations = []
    
        const parser = new DOMParser()
    
        // learner mode 
        if (mode == 0) {
            if (ptype == 0) {
                this.questionField.querySelectorAll("input, select").forEach(e => {
                    answers.push(e.value) // user answers
                }) 
            }
            else if (ptype == 1) {
                this.answerField.querySelectorAll("[data-node-type='code']").forEach(e => {
                    const codeNode = new CodeNode(e.getAttribute("data-node-id"))
                    answers.push(codeNode.editor.getValue()) // user answers
                })
            }
            return {
                "node_id": this.nodeId, // str
                "q_id": this.qId,           // str
                "ptype": ptype,         // int 
                "answers": answers      // list
            }
        }
    
        // creator mode 
        else if (mode == 1) {
            if (ptype == 0) {
                const e = this.questionField.querySelector("[data-node-type='explain']")
                const mdString = new ExplainNode(e?.getAttribute("data-node-id")).editor.getValue()
                const mdDOM = notNull(parser.parseFromString(mdString, "text/html").querySelector("body"))
                mdDOM.querySelectorAll("input[ans], select[ans]").forEach(e => { // currect answers
                    answers.push(e.getAttribute("ans"))
                })
                question = mdDOM.innerHTML // question
            }
            else if (ptype == 1) {
                const t = notNull(this.element.querySelector("[data-role='test-code'] > [data-node-type]"))
                answers.push(new CodeNode(t.getAttribute("data-node-id")).editor.getValue()) // answers
                const q = notNull(this.questionField.querySelector("[data-node-type='explain']"))
                question = new ExplainNode(q.getAttribute("data-node-id")).editor.getValue() // question
                
                editable = this.element.querySelector("[data-role='check-editable']")?.checked // editable
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
                const expContainer = notNull(
                    this.element.querySelector("[data-role='ExplanationNodeContainer']"),
                    new NodeStructureError(this.type)
                )
                expContainer.querySelectorAll(".node").forEach(e => {
                    const n = myNode.get(e)
                    if (n instanceof ExplainNode) {
                        explanations.push({
                            "type": nodeType.explain,
                            "content": n.editor.getValue()
                        })
                    } else if (n instanceof CodeNode) {
                        const param = n.extractCodeParams()
                        explanations.push({
                            "type": nodeType.code,
                            "content": param.content
                        })
                    }
                })
            }
            return {
                "node_id": node_id,         // str
                "q_id": q_id,               // str
                "ptype": ptype,             // int 
                "conponent": conponent,     // list
                "question": question,       // str
                "editable": editable,       // bool
                "answers": answers,          // list
                "explanations": explanations // list
            }
        }
        else {
            throw new NodeStructureError(this.type, `mode(${mode}) is invalid`)
        }
    }
    /** 解答の採点を行う */
    scoring = async () => {

        const params = this.extractQuestionParams(0)
        this._showProgressBar()
        const res = await fetch(`${window.location.origin}/scoring`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                "p_id": problem_meta.p_id,
                "q_id": params.q_id,
                "ptype": params.ptype,
                "answers": params.answers, 
                "job_id": this.nodeId
            })
        })
        
        if (res.ok && res.status == 200) {
            const json = await res.json()
            console.log(`[scoring] ${json.DESCR}`)
            const progress = json.result ? "2": "1"
            this.element.setAttribute("progress", progress)
            this._showToast(json.html)
            const questionNav = document.querySelector(`#question-nav a[href='#q-id-${params.q_id}']`)
            questionNav?.setAttribute("progress", progress)
            this._hideProgressBar()
        }
        else if (res.ok && res.status == 202) {}
        else { 
            this._hideProgressBar()
            throw new error.FetchError(res.status, res.statusText)
        }
    }
    _showToast = (content="") => {
        const toast = this.element.querySelector(".for-toast > .toast")
        const toastBody = this.element.querySelector(".for-toast > .toast > .toast-body")
        if (toastBody == null) {throw new NodeStructureError(this.type)}
        toastBody.innerHTML = content 
        toast?.classList.add("show")
    }
    _hideToast = () => {
        const toast = this.element.querySelector(".for-toast > .toast")
        if (toast == null) {throw new NodeStructureError(this.type)}
        toast.classList.remove("show")
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
        const res = await fetch(`${window.location.origin}/scoring?job_id=${this.nodeId}`, {
            method: "DELETE",
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
    /**
     * ユーザー解答を補完する
     * @param {string[]} answers 
     */
    answerCompletion = (answers) => {
        this.answerField.querySelectorAll("select, input").forEach((e, idx) => {
            if (e.tagName == "SELECT") {
                const optionValues = Array.from(e.options).map(op=>op.value)
                const optionIdx = optionValues.indexOf(answers[idx])
                e.selectedIndex = (optionIdx >= 0) ? optionIdx : 0
            } else {
                if (answers[idx] !== undefined) {
                    e.value = answers[idx]
                } else {
                    e.value = ""
                }
            }
        })
    }

    allowDelete () {
        return this.element.querySelector(".card-header [data-action='del-node']") != null
    }
    /** 内部のNodeを削除したうえで自身の要素を削除する  */
    delme () {
        this.element.querySelectorAll(".node[node-id]").forEach(e => {
            if (e.classList.contains(nodeType.code)) {
                new CodeNode(e).delme()
            } else if (e.classList.contains(nodeType.explain)) {
                new ExplainNode(e).delme()
            }
        })
        super.delme()
    }
}

/** ExplainNode, CodeNodeの親クラス. このクラスは直接インスタンス化しない */
export class EditorNode extends BaseNode {
    /** @param {string} node_id */
    constructor(node_id) {
        super(node_id) 
        this.hasAce = this.element.querySelector(".ace_text-input") != null
    }
    /** ace editorオブジェクトを取得する */
    get editor() {
        const aceTargetElem = notNull(this.element.querySelector("[data-role='ace-editor']:has(>.ace_text-input)"),
            new NodeStructureError(this.type, 
                "Ace Editor is not embeded.\n Use CodeNode or ExplainNode.")
        )
        return ace.edit(aceTargetElem)
    }
    /**
     * EditorNodeがQuestionNodeの内部にある場合, そのQuestionNodeのオブジェクトを返す.
     * 
     * 存在しない場合はnullを返す
     * @returns {QuestionNode | null}
     */
    get parentQuestionNode() {
        const parent = this.element.closest("[data-role='question']")
        if (parent) {return new QuestionNode(parent.dataset.nodeId)}
        return null
    } 
    /** ace editorに文章をいれる
     * @param {string} content
     */
    setValue (content) {
        this.editor.setValue(content)
    }
    /** ace editorを解除し，自身のElementを削除する */
    delme () {
        this.editor.destroy()
        super.delme()
    }
}
/** pythonを記述するためのノード */
export class CodeNode extends EditorNode {
    /**
     * BaseNodeの制約に加えて，
     * - data-node-type`: 'code'  
     * を持つ要素を元にCodeNodeオブジェクトを作成する
     * @param {string} node_id 
     */
    constructor(node_id) {
        super(node_id)
        if (this.element.dataset.nodeType != nodeType.code) {
            throw new NodeStructureError("CodeNode")
        }
        if (!this.hasAce) {
            this._registerAcePythonEditor()
        }
    }
    /**
     * 指定した要素がCodeNodeの制約を守っているかを確かめる
     * @param {HTMLElement} e 
     * @returns {boolean}
     */
    isNode = (e) => {
        return e.dataset.nodeType == nodeType.code
    }

    _registerAcePythonEditor = () => {
        const defaultLineNumbers = 5
        const maxLines = 25
        
        const editableElem = notNull(this.element.querySelector("[data-role='ace-editor']"),
            new NodeStructureError("CodeNode"))

        const editor = ace.edit(editableElem, {
            mode: "ace/mode/python",
            theme: "ace/theme/cloud_editor_dark",
            fontSize: "0.8rem",
            showPrintMargin: false,
            maxLines: maxLines,
            // minLines: defaultLineNumbers,
            readOnly: editableElem.classList.contains("readonly")
        });
        editor.container.childNodes[0].tabIndex = -1
        this.hasAce = true
    }
    /**  Codeインスタンスのパラメータを返す */
    extractCodeParams = () => {
        const content = this.editor.getValue()
        const readonlyFlag = this.element.querySelector("[data-role='check-readonly']")
        const readonly = (readonlyFlag != null) ? readonlyFlag.checked : false
        return {
            "content": content,
            "readonly": readonly
        }
    }
    /** Codeインスタンスの実行状態を初期化する */
    resetState = () => {
        const returnBox = this.element.querySelector("[data-role='execution-return']")
        if (returnBox == null) {throw new NodeStructureError(this.type)}
        returnBox.innerHTML = ""
        this.element.dataset.runState = runState.idle
    }
}
/** markdownを記述するためのノード */
export class ExplainNode extends EditorNode {
    /**
     * BaseNodeの制約に加えて，
     * - data-node-type`: 'explain'  
     * を持つ要素を元にCodeNodeオブジェクトを作成する
     * @param {string} node_id 
     */
    constructor(node_id) {
        super(node_id)
        if (this.element.dataset.nodeType != nodeType.explain) {
            throw new NodeStructureError("ExplainNode")
        }
        if (!this.hasAce) {
            this._registerAceMDE()
        }
    }
    _registerAceMDE = () => {
        const defaultLineNumbers = 5
        const maxLines = 40
    
        const editableElem = this.element.querySelector("[data-role='ace-editor']")
        if (editableElem === null) {throw new NodeStructureError("ExplainNode")}
    
        const editor = ace.edit(editableElem, {
            mode: "ace/mode/markdown",
            theme: "ace/theme/sql_server",
            fontSize: "0.9rem",
            showGutter: false,
            highlightActiveLine: false,
            maxLines: maxLines,
            minLines: defaultLineNumbers,
            wrap: "free"
        })
        editor.container.childNodes[0].tabIndex = -1
        this.hasAce = true
    }
    /** コードをhighlight.jsでハイライトする */
    highlighlting = () => {
        this.element.querySelectorAll("pre code").forEach(e => {
            hljs.highlightElement(e)
        })
    }
    /** previewを表示する */
    showPreview = () => {
        const html = marked.parse(this.editor.getValue())
        const preview = this.element.querySelector("[data-role='md-preview']")
        const mde = this.element.querySelector("[data-role='MDE']")
        if (mde == null || preview == null) {
            throw new NodeStructureError(this.type)
        }
        preview.innerHTML = html 
        // const html_escaped = html.replace(/(<pre[\s\S]*?>[\s\S]*?<\/pre>)|\n/g, match => {
        //     return match.startsWith("<pre") ? match : ""
        // })
        this.highlighlting()
        mde.classList.add("preview-active")
    }
    /** editorを表示する */
    showEditor = () => {
        const mde = this.element.querySelector("[data-role='MDE']")
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
            `<div class="question-form">`,
            `  ...Please enter a question text...`,
            `   <input type="text" class="form-control" placeholder="answer" ans="?????">`,
            `</div>`,
            ``
        ].join("\n")
        this.editor.insert(tag)
    }
    addSelectionProblem = () => {
        const tag = [
        `<div class="question-form">`,
        `  ...Please enter a question text...`,
        `  <select class="form-select" ans="???">`,
        `    <option> Open this select menu</option>`,
        `    <option value="1">???</option>`,
        `    <option value="2">???</option>`,
        `    <option value="3">???</option>`,
        `    <option value="4">???</option>`,
        `  </select>`,
        `</div>`,
        ``
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

/**
 * APIを通じてユーザー入力を取得し，word testのQuestion Nodeを補完する
 * @param {Element} container 
 */
export async function userAnswerCompletion(container) {
    const res = await fetch(`${window.location.origin}/api/saves/${problem_meta.p_id}`)
    if (res.ok) {
        const json = await res.json()
        
        const saveDatas = json.saves
        container.querySelectorAll(".node.question").forEach(e => {
            const questionNode = new QuestionNode(e)
            if (questionNode.ptype == "0") {
                if (saveDatas[questionNode.qId] !== undefined) {
                    questionNode.answerCompletion(saveDatas[questionNode.qId])
                }
            }
        })
    } 
    else {
        throw new error.FetchError(res.status, res.statusText)
    }
}