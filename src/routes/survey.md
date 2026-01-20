
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