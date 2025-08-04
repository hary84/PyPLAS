//@ts-check

import { myNode } from "./nodes.js"
import * as Nodes from "./nodes.js"
import { problem_meta } from "./helper.js"
import * as error from "./error.js"
import { notNull } from "./helper.js" 


/**
 * `ExplainNode`を追加する
 * @param {Element} loc 追加したい場所
 * @param {InsertPosition} pos 追加したい位置
 * @returns {Promise<Nodes.ExplainNode>} 
 */
export async function addMD(loc, pos, {
    content=String(), 
    allow_del=true, 
    editor=true,
    node_id=crypto.randomUUID()} = {}) 
{
    const res = await fetch(`${window.location.origin}/modules/explainNode`, {
        method: "POST",
        headers: {"Content-type": "application/json"},
        body: JSON.stringify({
            content: content,
            allow_del: allow_del,
            editor: editor,
            node_id: node_id
        })
    })
    if (res.ok) {
        const json = await res.json()
        const htmlString = json.html 
        loc.insertAdjacentHTML(pos, htmlString)
        const explainNode = new Nodes.ExplainNode(node_id)
        return explainNode
    }
    else {
        throw new error.FetchError(res.status, res.statusText)
    }

    }
/**
* Code Nodeを追加する.
* @param {Element} loc 
* @param {InsertPosition} pos 
* @returns {Promise<Nodes.CodeNode>} 
*/
export async function addCode(loc, pos, {
    content=String(), 
    user=0, 
    allow_del=true, 
    node_id=crypto.randomUUID(),
    readonly=false
    } = {}) 
{
    const res = await fetch(`${window.location.origin}/modules/codeNode`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
            content: content,
            user: user,
            allow_del: allow_del,
            node_id: node_id,
            readonly: readonly
        })
    })
    if (res.ok) {
        const json = await res.json()
        const htmlString = json.html 
        loc.insertAdjacentHTML(pos, htmlString)
        const codeNode = new Nodes.CodeNode(node_id)
        return codeNode
    }
    else {
        throw new error.FetchError(res.status, res.statusText)
    }
}
/**
* Question Nodeをappend_tailの後ろに追加する
* @param {Element} loc 
* @param {InsertPosition} pos 
* @returns {Promise<Nodes.QuestionNode>} 
*/
export async function addQ(loc, pos, {
    q_id = "temp",
    ptype = 0,
    node_id = crypto.randomUUID(),
    question =  String(),
    editable =  true
    } = {}) 
{
    const res = await fetch(`${window.location.origin}/modules/questionNode`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
            q_id: q_id,
            ptype: ptype,
            node_id: node_id,
            question: question,
            editable: editable
        })
    })
    if (res.ok) {
        const json = await res.json()
        loc.insertAdjacentHTML(pos, json.html)
        const questionNode = new Nodes.QuestionNode(node_id)
        return questionNode
    }
    else {
        throw new error.FetchError(res.status, res.statusText)
    }
}

/**
 * ユーザーの入力を保存する
 */
export async function saveUserData() {
    const userInput = {}
    document.querySelectorAll("[data-node-type='question']").forEach(e => {
        const questionNode = new Nodes.QuestionNode(Nodes.getNodeParamsByElement(e).node_id)
        const params = questionNode.extractQuestionParams(0)
        userInput[params.q_id] = params.answers
    })
    const res = await fetch(`${window.location.origin}/problems/${problem_meta.p_id}`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
            "content": userInput
        })})
    if (res.ok) {
        const json = await res.json()
        console.log(`[save] ${json.DESCR}`)
        alert("あなたの回答をDBに保存しました")
    } else {
        throw new error.FetchError(res.status, res.statusText)
    }
}
/**
 * ipynbをparseして, locの末尾にnodeとして挿入する
 * 
 * `user=0`のときはmarkdownは含めず，コードだけを挿入する
 * @param {File} file           
 * @param {Element} loc         
 * @param {number} user         
 */
export async function loadIpynb(file, loc, user=1) {
    const ipynb = file
    console.log(`[FileReader] '${ipynb.name}'をロード中`)
    const reader = new FileReader()
    reader.readAsText(ipynb)

    reader.onload = async () => {
        if (typeof reader.result != "string") {
            alert("ipynbファイルを読み込めませんでした.")
            return
        } 
        const cells = JSON.parse(reader.result).cells
    
        for (const cell of cells) {
            if (cell.cell_type == "code") {
                await addCode(loc, "beforeend", {
                    content: cell.source.join(""), 
                    user:user, 
                    allow_del:true,
                })
            }
            else if (user==1 && cell.cell_type == "markdown") {
                const node = await addMD(loc, "beforeend", {
                    content:cell.source.join(""), 
                    allow_del:true,
                })
                node.showPreview()
            }
        }
    }
    
    reader.onerror = () => {
        alert("Ipynbファイルの読み込みに失敗しました.")
    }
}
/**
 * ページ全体をパースしてサーバーに登録を要請する
 */
export async function registerProblem() {

    const title = document.querySelector("#titleForm")?.value
    const answers = {}
    const explanations = {}
    
    if (title === undefined || title.trim().length == 0) {
        alert("input problem title")
        return 
    }
    
    // 概要欄のSummary, Data Source, Environmentを取得
    const headers = []
    document.querySelectorAll("#summary [data-node-type='explain']").forEach(e => {
        const explainNode = notNull(myNode.get(e), new Error("問題ページヘッダを取得できませんでした"))
        headers.push(explainNode.editor.getValue())
    })
    
    // The Source CodeからNodeを取得
    const body = []
    let q_id = 1
    document.querySelectorAll("#nodesContainer > [data-role='node']").forEach(e => {
        const node = myNode.get(e)
        // Explain Node
        if (node instanceof Nodes.ExplainNode) {
            body.push({
                type: Nodes.nodeType.explain,
                content: node.editor.getValue(),
            })
        }
        // Code Node
        else if (node instanceof Nodes.CodeNode) {
            const params = node.extractCodeParams()
            body.push({
                type: Nodes.nodeType.code,
                content: params.content,
                readonly: params.readonly,
            })
        }
        // Question Node
        else if (node instanceof Nodes.QuestionNode) {
            const params = node.extractQuestionParams(1)
            answers[`${q_id}`] = params.answers 
            explanations[`${q_id}`] = params.explanations
            body.push({
                type: Nodes.nodeType.question, // str
                q_id: String(q_id),              // str
                ptype: params.ptype,             // int
                conponent: params.conponent,     // dict
                question: params.question,       // str
                editable: params.editable,       // bool
            })
            q_id += 1
        }
    })
    const page = {
        "header": {"summary": headers[0],
                   "source": headers[1],
                   "env": headers[2]},
        "body": body
    }
    const send_msg = {
        "title": title,                 // str
        "page": page,                   // dict
        "answers": answers,             // dict
        "explanations": explanations    // dict
    }

    const res = await fetch(`${window.location.origin}/create/${problem_meta.p_id}`,{
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(send_msg)
    })
    if (res.ok) {
        const json = await res.json()
        console.log(`[register] ${json.DESCR}`)
        alert("問題を登録しました")
        if (problem_meta.p_id === "new") {
            window.location.href = `/create/${json.p_id}`
        }
    }
    else {
        throw new error.FetchError(res.status, res.statusText)
    } 
}


/**
 * ログファイルをダウンロードする
 * @param {string} number 
 * @param {string} name 
 * @param {string} category 
 * @returns 
 */
export async function downloadLog(number, name, category) {
    if (number.trim() == "" || name.trim() == "") {
        alert("Please complete the form before downloading.")
        return 
    }

    const res = await fetch(
        `${window.location.origin}/files/log?cat=${category}&num=${number}&name=${name}`)
        
    if (res.ok) {
        const content = await res.blob()
        const objectUrl = window.URL.createObjectURL(content)
        const a = document.createElement("a")
        a.href = objectUrl
        a.download = `PyPLAS-${category}-${number}-${name}.csv`
        a.click()
        a.remove()
        window.URL.revokeObjectURL(objectUrl)
    } else {
        alert("Failed to download log file")
        throw new error.FetchError(res.status, res.statusText)
    }
}