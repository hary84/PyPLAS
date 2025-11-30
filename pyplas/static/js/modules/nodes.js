//@ts-check

import {problem_meta, notNull} from "./helper.js"
import * as error from "./error.js"
import * as utils from "./utils.js"

export const nodeType = {
    /** @type {"code"} */ code: "code",
    /** @type {"explain"} */ explain: "explain",
    /** @type {"question"} */ question: "question"
}

/** `QuestionNode`のパラメータ
 * @typedef QuestionNodeParams
 * @type {object}
 * @property {string} node_id {@link QuestionNode.node_id}
 * @property {string} q_id
 * @property {number} ptype {@link QuestionNode.ptypes}
 * @property {Array=}  conponent
 * @property {string=} question
 * @property {boolean=} editable
 * @property {Array=} answers
 * @property {Array=} explanations
 * @property {number=} user {@link QuestionNode.user}
 * @property {string=} progress {@link QuestionNode.progress}
 */

/** `CodeNode`のパラメータ
 * @typedef CodeNodeParams
 * @type {object}
 * @property {string} node_id {@link QuestionNode.node_id}
 * @property {string} content 
 * @property {boolean} readonly
 * @property {boolean=} allow_del
*/

/** `ExplainNode`のパラメータ
 * @typedef ExplainNodeParams
 * @type {object}
 * @property {string} node_id {@link QuestionNode.node_id}
 * @property {string} content 
 * @property {boolean} editor
 * @property {boolean} allow_del
*/

/** `Element`から`data-node-id`と`data-node-type`の値を抜き出す
 * @param {Element} e
 * @throws {NodeError} `e`にnode-idもしくはnode-typeが存在しないとき
 */
export function getNodeParamsByElement(e) {
    const dataset = e.dataset
    const node_id = dataset.nodeId
    const node_type = dataset.nodeType
    if (node_id === undefined || node_type === undefined) {
        throw new NodeError(`要素${e}にnode-idもしくはnode-typeが存在しません`)
    }
    return {
        /** @type {string} */
        node_id: node_id,
        /** @type {string} */
        node_type: node_type
    }
}


export const myNode = {
    /** 現在アクティブなノードを管理する */
    activeNode: {
        /** アクティブなノードのID
         * @type {string} */ 
        node_id: "",

        /** アクティブなノードを取得する */
        get() {
            return myNode.get(this.node_id)
        }
    },
    /**
     * node-idもしくはelementをうけとり、対応するNodeオブジェクトを返す. 
     * 
     * 対応するNodeオブジェクトが見つからない場合, nullを返す
     * @param {string | Element} specifier 
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
        else {
            throw new TypeError("引数`specifier`は`Element`か`string`で指定してください")
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
        const p = getNodeParamsByElement(e)
        if (p.node_type == nodeType.code) {
            return new CodeNode(p.node_id)
        }
        else if (p.node_type == nodeType.explain) {
            return new ExplainNode(p.node_id)
        }
        else if (p.node_type == nodeType.question) {
            return new QuestionNode(p.node_id)
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
        const e = nodeObj.prevNodeElement()
        if (e === null) {return null}
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
        if (e === null) return null
        return this.get(e)
    }
}

/** Nodeオブジェクトの基底クラス */
export class BaseNode {

    /** ノードを一意に識別するID
     *  @type {string} */
    node_id;

    /** Nodeオブジェクトを構成する`Element`
     * @type {HTMLElement} */
    element;
    
    /**
     * BaseNodeオブジェクトを作成する．  
     * BaseNodeオブジェクトは，`data-role='node'`かつ指定した`data-node-id`を持つ`Element`で構成される
     * 
     * @param {string} node_id
     * @throws {NodeError} 要素が存在しない場合
     */
    constructor(node_id) {
        this.type = this.constructor.name
        this.node_id = node_id
        const element = notNull(
            BaseNode.getNodeElementByNodeId(node_id), 
            new NodeError("指定したnode-idを持つ要素は存在しません")
        )
        this.element = element
    }
    /**
     * `data-role='node'`かつ`data-node-id=node_id`である要素をページ全体から探す.
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
     * 現在の要素よりも下にあり，ノード制約を守る`Element`を返す
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
     * 現在の要素よりも上にあり，ノード制約を守る`Element`を返す
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
    /** 
     * 対応する`Element`を削除する
     */
    delme() { 
        const nodeControl = this.element.nextElementSibling
        if (nodeControl != null && nodeControl.getAttribute("data-role") == "node-control") {
            nodeControl.remove()
        }
        this.element.remove()
        
    }
}

/** 問題を管理するクラス */
export class QuestionNode extends BaseNode {

    /** 問題タイプパラメータ */
    static ptypes = {
        /** @type {0} ワードテスト */ WORDTEST: 0,
        /** @type {1} コードテスト*/  CORDTEST: 1
    }

    /** 使用ユーザパラメータ */
    static user = {
        /** @type {0} 学習者 */     LEANER: 0, 
        /** @type {1} 問題作成者 */ CREATOR: 1 
    }

    /** 進捗パラメータ */
    static progress = {
        /** @type {"0"} 未挑戦 */  UNTRIED: "0",
        /** @type {"1"} 挑戦中 */  TRIED: "1",
        /** @type {"2"} 完了 */    COMPLETE: "2"
    }

    /** @type {string} `QuestionNode`を一意に指定するためのID */
    q_id

    /**  問題タイプ
     * @type {number} 
     * @see {@link QuestionNode.ptypes}を参照*/
    ptype

    /**
     * BaseNodeの制約に加えて，
     * - `data-node-type` = 'question'
     * - `data-q-id`
     * - `data-q-ptype`  
     * を持つ要素を元に作成する
     * 
     * 要素がないとき, `NodeStructureError`を投げる.
     * @param {string} node_id
     */
    constructor(node_id) {
        super(node_id)

        const dataset = this.element.dataset
        const pt = Number(notNull(dataset.qPtype, new NodeStructureError(this.type)))
        if (!Object.values(QuestionNode.ptypes).includes(pt)) {throw new NodeStructureError("ptypeの値が不正です")}

        this.ptype = pt
        this.q_id = notNull(dataset.qId, new NodeStructureError(this.type))

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

    get explanationField() {
        const c = this.element.querySelector("[data-role='ExplanationNodeContainer']")
        return c 
    }

    get isEditable() {
        /** @type {HTMLInputElement | null} */
        const c = this.element.querySelector("[data-role='check-editable']")
        if (this.ptype == QuestionNode.ptypes.WORDTEST) {
            return false
        }
        else if (this.ptype == QuestionNode.ptypes.CORDTEST) {
            const c2 = notNull(c, new NodeStructureError(this.type, "パラメータeditableを取得できませんでした"))
            return c2.checked
        }
        else {
            throw new NodeStructureError(this.type, "パラメータptypeが不適です")
        }
    }

    /** `QuestionNode`内のEditorNodeのace editorを有効化する*/
    activate = () => {
        this.element.querySelectorAll("[data-role='node']").forEach(e => {
            const p = getNodeParamsByElement(e)
            if (p.node_type == nodeType.code) {
                new CodeNode(p.node_id)
            } 
            else if (p.node_type == nodeType.explain) {
                new ExplainNode(p.node_id)
            }
        })
    }

    /**
     * Questionインスタンスのパラメータを返す
     * @param {0 | 1} mode 0: leaner, 1: creator
     * @returns {QuestionNodeParams}
     */
    extractQuestionParams (mode) {
        const conponent = []
        const answers = []
        let question = ""
        const explanations = []
    
        // 学習者用パラメータの場合
        if (mode == 0) {
            if (this.ptype == QuestionNode.ptypes.WORDTEST) {
                this.questionField.querySelectorAll("input, select").forEach(e => {
                    answers.push(e.value) // user answers
                }) 
            }
            else if (this.ptype == QuestionNode.ptypes.CORDTEST) {
                this.answerField.querySelectorAll("[data-node-type='code']").forEach(e => {
                    const p = getNodeParamsByElement(e)
                    const codeNode = new CodeNode(p.node_id)
                    answers.push(codeNode.editor.getValue()) // user answers
            })
            }
            return {
                node_id: this.node_id, // str
                q_id: this.q_id,       // str
                ptype: this.ptype,         // int 
                answers: answers      // list
            }
        }
    
        // 開発者用パラメータの場合
        else if (mode == 1) {
            const e = notNull(this.questionField.querySelector("[data-node-type='explain']"))
            const p = getNodeParamsByElement(e)
            const ques_info = new ExplainNode(p.node_id)
            question = ques_info.editor.getValue() 

            if (this.ptype == QuestionNode.ptypes.WORDTEST) { 
                ques_info.showPreview()
                const preview = notNull(ques_info.element.querySelector("[data-role='md-preview']"))
                preview.querySelectorAll("input[ans], select[ans]").forEach(e => { // currect answers
                    answers.push(e.getAttribute("ans"))
                })
            }
            else if (this.ptype == QuestionNode.ptypes.CORDTEST) {
                const t = notNull(this.element.querySelector("[data-role='test-code'] > [data-node-type]"))
                answers.push(new CodeNode(getNodeParamsByElement(t).node_id).editor.getValue()) // answers

                if (!this.isEditable) { // conponent
                    this.answerField.querySelectorAll("[data-role='node']").forEach(e => {
                        const p = getNodeParamsByElement(e)
                        if (p.node_type == nodeType.explain) {
                            conponent.push({
                                type: nodeType.explain,
                                content: new ExplainNode(p.node_id).editor.getValue()
                            })
                        }
                        else if (p.node_type == nodeType.code) {
                            const param = new CodeNode(p.node_id).extractCodeParams()
                            conponent.push({
                                type: nodeType.code,
                                content: param.content,
                                readonly: param.readonly
                            })
                        }
                    })
                }
                
                notNull(this.explanationField).querySelectorAll("[data-role='node']").forEach(e => {
                    const p = getNodeParamsByElement(e)
                    if (p.node_type == nodeType.explain) {
                        explanations.push({
                            type: nodeType.explain,
                            content: new ExplainNode(p.node_id).editor.getValue()
                        })
                    }
                    else if (p.node_type == nodeType.code) {
                        const param = new CodeNode(p.node_id).extractCodeParams()
                        explanations.push({
                            type: nodeType.code,
                            content: param.content,
                            readonly: param.readonly
                        })
                    }
                })
            }
            return {
                node_id: this.node_id,          // str
                q_id: this.q_id,                // str
                ptype: this.ptype,              // int 
                conponent: conponent,           // list
                question: question,             // str
                editable: this.isEditable,      // bool
                answers: answers,               // list
                explanations: explanations      // list
            }
        }
        else {
            throw new NodeStructureError(this.type, `mode(${mode}) is invalid`)
        }
    }
    /** 解答の採点を行う */
    scoring = async () => {
        this._showProgressBar()
        
        const params = this.extractQuestionParams(0)
        console.log(params)
        const res = await fetch(`${window.location.origin}/scoring`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                p_id: problem_meta.p_id,
                q_id: params.q_id,
                ptype: params.ptype,
                answers: params.answers, 
                job_id: this.node_id
            })
        })
        
        if (res.ok && res.status == 200) {
            const json = await res.json()
            console.log(`[scoring] ${json.DESCR}`)

            // 結果からQuestionNodeの進捗バッチを更新する
            const progress = json.result ? QuestionNode.progress.COMPLETE : QuestionNode.progress.TRIED
            this.element.dataset.qProgress = progress

            // トーストを表示してプログレスバーを非表示
            this._showToast(json.html)
            this._hideProgressBar()
            if (progress == QuestionNode.progress.COMPLETE && this.ptype == QuestionNode.ptypes.CORDTEST) {
                this.explanationField.innerHTML = ""
                const exp = JSON.parse(json.explanation)
                for (var n of exp) {
                    if (n.type == nodeType.code) {
                        await utils.addCode(this.explanationField, "beforeend", {
                            content: n.content,
                            user: QuestionNode.user.LEANER,
                            allow_del: false,
                        })
                    } else if (n.type == nodeType.explain) {
                        try {
                            await utils.addMD(this.explanationField, "beforeend", {
                                /** @ts-ignore highlight.js, marked.js */
                                content: marked.parse(n.content),
                                allow_del: false,
                                editor: false
                            })
                        } catch (e) {
                            if (e instanceof NodeError) {}
                            else {throw e}
                        }
                    }
                }
                this.explanationField?.querySelectorAll("pre code").forEach(e => {
                    // @ts-ignore highlight.js
                    hljs.highlightElement(e);
                })
            }
        }
        else if (res.ok && res.status == 202) {}
        else { 
            this._hideProgressBar()
            throw new error.FetchError(res.status, res.statusText)
        }
    }
    /** トーストに文字列を入れて表示 */
    _showToast = (content="") => {
        const toast = this.element.querySelector(".for-toast > .toast")
        const toastBody = this.element.querySelector(".for-toast > .toast > .toast-body")
        if (toastBody == null) {throw new NodeStructureError(this.type)}
        toastBody.innerHTML = content 
        toast?.classList.add("show")
    }
    /**トーストを非表示 */
    _hideToast = () => {
        const toast = this.element.querySelector(".for-toast > .toast")
        if (toast == null) {throw new NodeStructureError(this.type)}
        toast.classList.remove("show")
    }
    /** プログレスバーを表示 */
    _showProgressBar = () => {
        const progressBar = this.element.querySelector("[data-role='progress-bar']")
        if (progressBar == null) {throw new NodeStructureError(this.type)}
        progressBar.classList.remove("d-none")
    }
    /** プログレスバーを非表示 */
    _hideProgressBar = () => {
        const progressBar = this.element.querySelector("[data-role='progress-bar']")
        if (progressBar == null) {throw new NodeStructureError(this.type)}
        progressBar.classList.add("d-none")
    }
    /** 採点のキャンセル */
    canceling = async () => {
        const res = await fetch(`${window.location.origin}/scoring?job_id=${this.node_id}`, {
            method: "DELETE",
        })
        if (res.ok) {
            const json = await res.json()
            console.log(json.DESCR)
        }
        else { throw new error.FetchError(res.status, res.statusText) }
    }

    /**
     * answerfield内部に存在するNodeのリストを取得
     * @returns {Array<EditorNode>}
     */
    get answerNodes () {
        const nodeList = []
        this.answerField.querySelectorAll("[data-role='node']").forEach(e => {
            const p = getNodeParamsByElement(e)
            if (p.node_type == nodeType.code) {
                nodeList.push(new CodeNode(p.node_id))
            } else if (p.node_type == nodeType.explain) {
                nodeList.push(new ExplainNode(p.node_id))
            }
        }) 
        return nodeList
    }
    /**
     * ユーザー解答を補完する
     * @param {string[]} answers 
     */
    answerCompletion = (answers) => {
        this.questionField.querySelectorAll("select, input").forEach((e, idx) => {
            // SELECTタグの初期値を設定する
            if (e.tagName == "SELECT") {
                // @ts-ignore eはHTMLSelectElementであることが確認済み
                const optionValues = Array.from(e.options).map(op=>op.value)
                const optionIdx = optionValues.indexOf(answers[idx])
                // @ts-ignore eはHTMLSelectElementであることが確認済み
                e.selectedIndex = (optionIdx >= 0) ? optionIdx : 0
            // INPUTタグの初期値を設定する
            } else {
                if (answers[idx] !== undefined) {
                    // @ts-ignore eはHTMLInputElementであることが確認済み
                    e.value = answers[idx]
                } else {
                    // @ts-ignore eはHTMLInputElementであることが確認済み
                    e.value = ""
                }
            }
        })
    }
    /** 内部のNodeを削除したうえで自身の要素を削除する  */
    delme () {
        this.element.querySelectorAll("[data-role='node']").forEach(e => {
            const p = getNodeParamsByElement(e)
            new EditorNode(p.node_id).delme()
        })
        super.delme()
    }
}

/** ExplainNode, CodeNodeの親クラス.  */
export class EditorNode extends BaseNode {

    /** Ace Editorが有効化されているか
     * @type {boolean}
     */
    hasAce = false

    /**
     * Ace Editorを持つ，`ExplainNode`, `CodeNode`の親クラス  
     *  @param {string} node_id */
    constructor(node_id) {
        super(node_id) 
        this.hasAce = this.element.querySelector(".ace_text-input") !== null
    }
    
    /** ace editorオブジェクトを取得する */
    get editor() {
        const aceTargetElem = notNull(
            this.element.querySelector("[data-role='ace-editor']:has(>.ace_text-input)"),
            new NodeStructureError(this.type, "Ace Editorが埋め込まれていません. ")
        )
        // @ts-ignore aceはCDNで取得する
        return ace.edit(aceTargetElem)
    }
    /**
     * `EditorNode`が`QuestionNode`の内部にある場合, その`QuestionNode`を返す.
     * @returns {QuestionNode | null}
     */
    get parentQuestionNode() {
        const parent = this.element.closest("[data-node-type='question']")
        if (parent !== null) {return new QuestionNode(getNodeParamsByElement(parent).node_id)}
        return null
    } 
    /** Ace Editorの登録
     * 
     * 下位クラスで定義する
     */
    register = () => {}

    /** ace editorを解除し，自身のElementを削除する */
    delme () {
        this.editor.destroy()
        super.delme()
    }
}

/** pythonを記述するためのノード */
export class CodeNode extends EditorNode {

    /** `CodeNode`の実行状態 */
    static runState = {
        /** @type {"idle"} */ IDLE: "idle",
        /** @type {"queued"} */ QUEUED: "queued",
        /** @type {"running"} */ RUNNING: "running",
        /** @type {"complete"} */ COMPLETE: "complete"
    }

    /**
     * BaseNodeの制約に加えて，
     * - data-node-type`: 'code'  
     * を持つ要素を元にCodeNodeオブジェクトを作成する
     * @param {string} node_id 
     */
    constructor(node_id) {
        super(node_id)
        if (!this.hasAce) { this.register() }
    }

    /** Python用Ace Editorを埋め込む */
    register = () => {
        const defaultLineNumbers = 5
        const maxLines = 25
        
        const editableElem = notNull(this.element.querySelector("[data-role='ace-editor']"),
            new NodeStructureError("CodeNode"))

        // @ts-ignore aceはCDNから取得
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

    /**  Codeインスタンスのパラメータを返す
     * @returns {CodeNodeParams}
     */
    extractCodeParams = () => {
        /**@type {HTMLInputElement} */
        const readonlyFlag = notNull(this.element.querySelector("[data-role='check-readonly']"))
        return {
            node_id: this.node_id,
            content: this.editor.getValue(),
            readonly: readonlyFlag.checked
        }
    }
    /** Codeインスタンスの実行状態を初期化する */
    resetState = () => {
        const returnBox = this.element.querySelector("[data-role='execution-return']")
        if (returnBox == null) {throw new NodeStructureError(this.type)}
        returnBox.innerHTML = ""
        this.element.dataset.runState = CodeNode.runState.IDLE
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
        if (!this.hasAce) {this.register()}
    }

    /**markdown用Ace Editorを埋め込む */
    register = () => {
        const defaultLineNumbers = 5
        const maxLines = 40
    
        const editableElem = this.element.querySelector("[data-role='ace-editor']")
        if (editableElem === null) {throw new NodeStructureError("ExplainNode")}
    
        // @ts-ignore Ace EditorはCDNから
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
            // @ts-ignore highlight.js
            hljs.highlightElement(e)
        })
    }
    /** previewを表示する */
    showPreview = () => {
        // @ts-ignore marked.js
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