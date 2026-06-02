' ============================================================
' filterKeys 是可選參數（Optional）
' 不傳的話 = 原本行為，全部輸出
' 傳入的話 = 只輸出第一層符合的 key
' 注意：filterKeys 只對「最外層的 Dictionary」有效
'       內層的 Object 會整個保留不過濾
' ============================================================
Function ToCompactJson(val As Variant, Optional filterKeys As Variant) As String

    Dim i As Long
    Dim key As Variant
    
    ' ── 判斷 filterKeys 有沒有被傳入 ──────────────────────
    ' IsMissing → 檢查 Optional 參數是否被省略
    ' HasFilter = True 表示「有指定要過濾的 key 清單」
    Dim hasFilter As Boolean
    hasFilter = Not IsMissing(filterKeys)

    ' ── 情況①：Null 或 Empty ──────────────────────────────
    If IsNull(val) Or IsEmpty(val) Then
        ToCompactJson = ""
        Exit Function
    End If

    ' ── 情況②：Array ──────────────────────────────────────
    If IsArray(val) Then
        Dim arrParts() As String
        Dim arrCount As Long
        arrCount = 0
        ReDim arrParts(LBound(val) To UBound(val))
        
        For i = LBound(val) To UBound(val)
            Dim arrItem As String
            ' 陣列內的元素遞迴時，不傳 filterKeys
            ' 因為過濾只作用在最外層，內層全部保留
            arrItem = ToCompactJson(val(i))
            If arrItem <> "" Then
                arrParts(arrCount) = arrItem
                arrCount = arrCount + 1
            End If
        Next i
        
        If arrCount = 0 Then
            ToCompactJson = "[]"
        Else
            ReDim Preserve arrParts(0 To arrCount - 1)
            ToCompactJson = "[" & Join(arrParts, ",") & "]"
        End If

    ' ── 情況③：Dictionary ─────────────────────────────────
    ElseIf TypeName(val) = "Dictionary" Then
        Dim objParts() As String
        Dim objCount As Long
        objCount = 0
        ReDim objParts(0 To val.Count - 1)
        
        For Each key In val.Keys
        
            ' ★ 過濾邏輯在這裡 ★
            ' 如果有指定 filterKeys，就檢查這個 key 是否在清單內
            ' 如果不在清單內，直接 跳過（GoTo SkipKey）
            If hasFilter Then
                Dim keyFound As Boolean
                keyFound = False
                
                Dim j As Long
                ' 跑過 filterKeys 陣列，看看有沒有符合的
                For j = LBound(filterKeys) To UBound(filterKeys)
                    ' StrComp(..., vbTextCompare) = 0 → 不分大小寫的字串比較
                    ' = 0 表示「相等」
                    If StrComp(CStr(key), CStr(filterKeys(j)), vbTextCompare) = 0 Then
                        keyFound = True
                        Exit For   ' 找到了就不用繼續找
                    End If
                Next j
                
                ' 這個 key 不在過濾清單裡 → 跳過
                If Not keyFound Then GoTo SkipKey
            End If
            
            ' ★ 內層 value 遞迴時，不傳 filterKeys（內層全部保留）
            Dim itemVal As String
            itemVal = ToCompactJson(val(key))
            
            If itemVal <> "" Then
                objParts(objCount) = """" & CStr(key) & """:" & itemVal
                objCount = objCount + 1
            End If
            
SkipKey:    ' GoTo 的跳躍目標，標籤名稱後面加冒號
        Next key
        
        If objCount = 0 Then
            ToCompactJson = "{}"
        Else
            ReDim Preserve objParts(0 To objCount - 1)
            ToCompactJson = "{" & Join(objParts, ",") & "}"
        End If

    ' ── 情況④：Boolean ────────────────────────────────────
    ElseIf TypeName(val) = "Boolean" Then
        ToCompactJson = IIf(val, "true", "false")

    ' ── 情況⑤：數字 ──────────────────────────────────────
    ElseIf IsNumeric(val) Then
        ToCompactJson = CStr(val)

    ' ── 情況⑥：字串 ──────────────────────────────────────
    Else
        Dim s As String
        s = CStr(val)
        s = Replace(s, "\", "\\")
        s = Replace(s, """", "\""")
        s = Replace(s, Chr(10), "\n")
        s = Replace(s, Chr(13), "\r")
        s = Replace(s, Chr(9), "\t")
        ToCompactJson = """" & s & """"
    End If

End Function


Sub TestFilter()
    Dim person As New Scripting.Dictionary
    Dim addr As New Scripting.Dictionary
    
    addr("city") = "Taipei"
    addr("zip") = "100"
    
    person("name") = "Azusa"
    person("age") = 30
    person("address") = addr
    person("deleted") = Null
    
    ' 不過濾，全部輸出
    Debug.Print ToCompactJson(person)
    ' → {"name":"Azusa","age":30,"address":{"city":"Taipei","zip":"100"}}
    
    ' 只輸出 name 和 address（address 內層完整保留）
    Debug.Print ToCompactJson(person, Array("name", "address"))
    ' → {"name":"Azusa","address":{"city":"Taipei","zip":"100"}}
    
    ' 只輸出 age
    Debug.Print ToCompactJson(person, Array("age"))
    ' → {"age":30}
End Sub
