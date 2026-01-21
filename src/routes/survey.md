
```sql
SELECT
  q.id    AS question_id,
  q.title AS question_title,
  o.id    AS option_id,
  o.title AS option_title,

  COUNT(r.id) AS selected_count,

  ROUND(
    COUNT(r.id)::numeric
    /
    NULLIF(
      (
        SELECT COUNT(*)
        FROM responses r2
        WHERE r2.question_id = q.id
      ),
      0
    )
    * 100,
    2
  ) AS answer_rate_percent
FROM questions q
JOIN options o
  ON o.question_id = q.id
LEFT JOIN responses r
  ON r.option_id = o.id
GROUP BY
  q.id, o.id
ORDER BY
  q.id, o.id;
```

```sql
SELECT
  q.id    AS question_id,
  q.title AS question_title,
  o.id    AS option_id,
  o.title AS option_title,

  COUNT(r.id) AS selected_count,

  ROUND(
    COUNT(r.id)::numeric
    / NULLIF(
        SUM(COUNT(r.id)) OVER (PARTITION BY q.id),
        0
      )
    * 100,
    2
  ) AS answer_rate_percent
FROM questions q
JOIN options o
  ON o.question_id = q.id
LEFT JOIN responses r
  ON r.option_id = o.id
GROUP BY
  q.id, o.id
ORDER BY
  q.id, o.id;

```


In PostgreSQL, I have survey -> questions -> options tables,
and a responses table storing selected option per question.

How can I calculate, for each question,
the percentage distribution of responses per option?

Please include a solution using window functions
and handle division by zero safely.


```sql
concat(
  floor(
    extract(year from age(responses.answer_date, users.birthday)) / 10
  ) * 10,
  '代'
) as age_group_label

```


如果我有個案卷調查table(Survey)，底下有個問題table(Questions)，問題的底下還有個選項table(Options)假設每個table都只有id跟title還有order欄，現在再增加一個回答table(Responses)(欄位有questions_id, options_id, free_answer_text)其資料的連結方式為Questions.id
請幫我生出postgresql
第一行`Q${Questions.order}_${Options.title}`
第二行之後Responses table內有Options.id的顯示Options.order沒有的顯示free_answer_text 再沒有的顯示空白


先 query 出
```sql
SELECT q.order, o.order, o.title
FROM questions q
JOIN options o ON o.question_id = q.id
WHERE q.survey_id = :survey_id
ORDER BY q.order, o.order;

```

後端（Node.js）動態組 SQL

```javascript
`Q${qOrder}_${oTitle}`

```

```javascript
const rows = result.rows;

const responseMap = {};
const columns = new Set();

for (const row of rows) {
  const {
    response_id,
    question_order,
    option_id,
    option_order,
    option_title,
    response_option_id,
    free_answer_text
  } = row;

  // 初始化每一筆 response
  if (!responseMap[response_id]) {
    responseMap[response_id] = { response_id };
  }

  // 動態欄位 key
  const columnKey = `Q${question_order}_${option_title}`;
  columns.add(columnKey);

  let value = '';

  // 規則 1：有選項命中
  if (response_option_id === option_id) {
    value = option_order;
  }
  // 規則 2：沒有 option，用自由回答
  else if (response_option_id === null && free_answer_text) {
    value = free_answer_text;
  }

  responseMap[response_id][columnKey] = value;
}
```







