
/**
 * ページ全体をパースしてサーバーに登録を要請する
 * 
 * p_id == 'new'の場合、新規登録, それ以外の値の場合は既存の問題の更新
 * @param {str} p_id 問題id
 * @returns {none}
 */
async function registerProblem(p_id) {

    const title = document.querySelector("#titleForm").value
    if (title.length == 0) {
        alert("input problem title")
        return 
    }
    // 概要欄のSummary, Data Source, Environmentを取得
    const headers = []
    document.querySelectorAll("#summary .node.explain").forEach(e => {
        const explainNode = myNode.explain(e)
        headers.push(explainNode.editor.getValue())
    })
    // The Source CodeからNodeを取得
    const body = []
    const answers = {}
    let q_id = 1
    document.querySelectorAll("#nodesContainer > .node").forEach(e => {
        const node = myNode.get(e)
        // Explain Node
        if (node instanceof ExplainNode) {
            body.push({
                "type": "explain",
                "content": node.editor.getValue()
            })
        }
        // Code Node
        else if (node instanceof CodeNode) {
            const params = node.extractCodeParams()
            body.push({
                "type": "code",
                "content": params.content,
                "readonly": params.readonly
            })
        }
        // Question Node
        else if (node instanceof QuestionNode) {
            const params = node.extractQuestionParams(1)
            answers[`${q_id}`] = params.answers 
            body.push({
                "type": "question",             // str
                "q_id": String(q_id),    // str
                "ptype": params.ptype,          // int
                "conponent": params.conponent,  // dict
                "question": params.question,    // str
                "editable": params.editable,    // bool
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
        "title": title,       // str
        "page": page,         // dict
        "answers": answers    // dict
    }

    const res = await fetch(`${window.location.origin}/create/${p_id}/register`,{
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(send_msg)
    })
    const json = await res.json()
    if (res.ok) {
        console.log(`[register] ${json.DESCR}`)
        window.location.href = `/create/${json.p_id}`
    }
    else {
        alert(json.DESCR)
    }
}
/**
 * 問題の削除を要請する
 * @param {string} p_id 対象となる問題のp_id
 */
async function deleteProblem(p_id) {
    const agree = confirm("本当に削除しますか？")
    if (agree) {
        const res = await fetch(`${window.location.origin}/create/${p_id}`, {
            method: "DELETE",
        })
        const json = await res.json()
        console.log(`[deleteProblem] ${json.DESCR}`)
        if(!res.ok) {
            alert(json.DESCR)
        }
        else {
            window.location.reload()
        }
    }
}
/**
 * pageのstatus, category, titleを変更する
 * @param {array} changedParams {p_id: [title, category, status]}
 */
async function updateProfiles(changedParams) {
    const res = await fetch(`${window.location.origin}/create/profile`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({"profiles": changedParams})
    })
    const json = await res.json()
    if (res.ok) {
        window.location.reload()
    }
    else {
        alert(json.DESCR)
    }
}
/**
 * create_index.htmlのform(input, select)の変更を監視する
 * 
 * formに変更があった際に、グローバル変数changedParamsにp_id, title, category, status
 * を格納する。
 */
function observeForm() {
    const initialFormValue = {}
    document.querySelectorAll("input, select").forEach(elem => {
        const p_id = elem.closest("tr").getAttribute("target")
        if (!(p_id in initialFormValue)) {
            initialFormValue[p_id] = {}
        }
        const tag = elem.getAttribute("for")
        initialFormValue[p_id][tag] = elem.value
    })

    document.querySelectorAll("input, select").forEach(elem => {
        elem.addEventListener("change", () => {
            const tr = elem.closest("tr")
            const p_id = tr.getAttribute("target")
            const changed = {}
            tr.querySelectorAll("input, select").forEach(elem => {
                const tag = elem.getAttribute("for")
                changed[tag] = elem.value
            })
            if (initialFormValue[p_id]["title"] != changed["title"]
                || initialFormValue[p_id]["category"] != changed["category"]
                || initialFormValue[p_id]["status"] != changed["status"]) {
                    changedParams[p_id] = changed
                    tr.classList.add("table-danger")
                }
            else {
                delete changedParams[p_id]
                tr.classList.remove("table-danger")
            }
            console.log(changedParams)
        })
    })
}
