const myNode = {
    activeNode: {
        node_id: undefined,
        get() {
            return myNode.get(this.node_id)
        }
    },
    /**
     * node-idもしくはelementをうけとり、対応するNodeオブジェクトを返す. 
     * 
     * 対応するNodeオブジェクトが見つからない場合, nullを返す
     * @param {string | Element | BaseNode} specifier 
     * @returns {BaseNode | null}
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
            throw new NodeError("can not get Code Node from specifier.")
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
     * @returns {BaseNode | null}
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
     * @returns {BaseNode | null}
     */
    _getNodeObjectByNodeId(nodeId) {
        const e = BaseNode.getNodeElementByNodeId(nodeId)
        return this._getNodeObjectByElem(e)
    },
    /**
     * 前のNodeオブジェクトを取得する.
     * 
     * 存在しない場合nullを返す
     * @param {BaseNode}
     * @returns {BaseNode | null}
     */
    prevNode(nodeObj) {
        if (!(nodeObj instanceof BaseNode)) {
            throw new TypeError("invalid argument 'nodeObj'.")
        }
        const e = nodeObj.prevNodeElement()
        return this.get(e)
    },
    /**
     * 次のNodeオブジェクトを取得する. 
     * 
     * 存在しない場合nullを返す.
     * @param {BaseNode}
     * @returns {BaseNode | null}
     */
    nextNode(nodeObj) {
        if (!(nodeObj instanceof BaseNode)) {
            throw new TypeError("invalid argument 'nodeObj'.")
        }
        const e = nodeObj.nextNodeElement()
        return this.get(e)
    }

}
/**
 * Nodeオブジェクトの基底クラス
 */
class BaseNode {
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
            if (!e) {throw new NodeStructureError(this.type)}
            this.nodeId = specifier
            this.element = e
        }
        else {
            const nodeId = specifier.getAttribute("node-id")
            if (!specifier.classList.contains("node") || !nodeId) {
                throw new NodeStructureError(this.type)
            }
            this.nodeId = nodeId
            this.element = specifier
        }
    }
    /**
     * node-idから対応する.nodeをもつ要素を返す
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
     * @returns {null}
     */
    delme = () => {
        if (!this.allowDelete()) { return }
        const nodeControl = this.element.nextElementSibling
        if (nodeControl.classList.contains("node-control")) {
            nodeControl.remove()
        }
        this.element.remove()
    }
}

class QuestionNode extends BaseNode {
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
        try {
            this.element.querySelectorAll(".node.code, .node.explain").forEach(e => {
                new EditorNode(e)
            })
            this.qId = this.element.getAttribute("q-id")
        }
        catch (e) {
            throw new NodeStructureError(this.type)
        }
    }
    /**
     * Questionインスタンスのパラメータを返す
     * @param {Number} mode 
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
        const answerContent = this.element.querySelector(".answer-content")
    
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
                question = new CodeNode(this.element.querySelector(".question-info .code.node")).editor.getValue() // question
                
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
     * @param {string} p_id 
     */
    scoring = async (p_id) => {
        const params = this.extractQuestionParams(0)
        this.element.querySelector(".progress").classList.remove("d-none")
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
        this.element.querySelector(".progress").classList.add("d-none")

        const json = await res.json()
        if (res.ok) {
            console.log(`[scoring] ${json.DESCR}`)
            this.element.setAttribute("progress", json.progress)
            const toast = this.element.querySelector(".for-toast > .toast")
            toast.querySelector(".toast-body").innerHTML = json.content
            toast.classList.add("show")
            document.querySelector(`#question-nav a[href='#q-id-${params.q_id}']`).setAttribute("progress", json.progress)
        }
        else {
            console.log(`[scoring] ${json.DESCR}`)
        }
    }
    /**
     * 採点のキャンセル
     * @param {string} p_id 
     */
    canceling = async (p_id) => {
        const res = await fetch(`${window.location.origin}/problems/${p_id}/cancel?kernel_id=${this.nodeId}`, {
            method: "POST",
        })
        const json = await res.json()
        console.log(json.DESCR)
    }

    /**
     * 内部に存在するEditorNodeのリストを返す
     * @returns {Array<EditorNode>}
     */
    get childNodes () {
        const nodeList = []
        try {
            this.element.querySelectorAll(".answer-content > .node").forEach(e => {
                if (e.classList.contains(".code")) {
                    nodeList.push(new CodeNode(e))
                }else if (e.classList.contains(".explain")) {
                    nodeList.push(new ExplainNode(e))
                }
            }) 
            return this.element.querySelectorAll(".answer-content > .node")
        }
        catch (e) {
            throw new NodeStructureError(this.type)
        }
    }
}

class EditorNode extends BaseNode {
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
        
        try {
            const editableElem = this.element.querySelector(".node-code")
            const editor = ace.edit(editableElem, {
                mode: "ace/mode/python",
                theme: "ace/theme/one_dark",
                showPrintMargin: false,
                maxLines: maxLines,
                minLines: defaultLineNumbers,
                readOnly: editableElem.classList.contains("readonly")
            });
            editor.container.childNodes[0].tabIndex = -1
        } catch (e) {
            if ( e instanceof TypeError) {
                throw new NodeStructureError("CodeNode")
            }
        }
    }
    /**
     * Markdown ace editorを有効化する
     */
    _registerAceMDE = () => {
        const defaultLineNumbers = 5
        const maxLines = 40
    
        try {
            const editableElem = this.element.querySelector(".node-mde")
        
            const editor = ace.edit(editableElem, {
                mode: "ace/mode/markdown",
                theme: "ace/theme/sql_server",
                showGutter: false,
                highlightActiveLine: false,
                maxLines: maxLines,
                minLines: defaultLineNumbers
            })
            editor.container.childNodes[0].tabIndex = -1
        } catch (e) {
            if (e instanceof TypeError) {
                throw new NodeStructureError("explain")
            }
        }
    }

    /**
     * EditorNodeがQuestionNodeの内部にある場合, そのQuestionNodeのオブジェクトを返す.
     * 
     * 存在しない場合はnullを返す
     * @returns {QuestionNode | null}
     */
    get parentQuestionNode() {
        try {
            return new QuestionNode(this.element.closest(".question"))
        } catch {
            return null
        }
    } 
}
class CodeNode extends EditorNode {
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
        this.element.querySelector(".return-box").innerHTML = ""
        this.element.querySelector(".node-side").classList.remove("bg-success-subtle")
    }

}

class ExplainNode extends EditorNode {
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
        preview.innerHTML = html 
        this.highlighlting(preview)
        this.element.querySelector(".mde").classList.add("preview-active")
    }
    showEditor = () => {
        this.element.querySelector(".mde").classList.remove("preview-active")
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
        this.editor.insert("![]()")
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

class ApplicationError extends Error {
    constructor(msg) {
        super(msg)
        this.name = this.constructor.name
    }
}

class KernelError extends ApplicationError {
    constructor(msg) {
        super(msg)
    }
}

class NodeError extends ApplicationError {
    constructor(msg) {
        super(msg)
    }
}

class NodeStructureError extends NodeError {
    constructor(nodeType) {
        super(`Invalid node structure in ${nodeType} node`)
        this.nodeType = nodeType
    }
}
