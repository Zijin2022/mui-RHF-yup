' ============================================================
' 外部エントリーポイント（呼び出し側はこれだけ使う）
' sc を一回だけ作って内部関数に渡す
' ============================================================
Function ToCompactJson(val As Variant, Optional filterKeys As Variant) As String
    Dim sc As Object
    Set sc = CreateObject("ScriptControl")
    sc.Language = "JScript"
    
    ToCompactJson = ToCompactJsonInner(val, sc, filterKeys, True)
    
    Set sc = Nothing
End Function

' ============================================================
' 内部の再帰関数（sc を使い回す）
' isTopLevel = True のときだけ filterKeys を適用する
' ============================================================
Private Function ToCompactJsonInner(val As Variant, sc As Object, _
                                     Optional filterKeys As Variant, _
                                     Optional isTopLevel As Boolean = False) As String
    Dim i As Long
    Dim key As Variant
    
    Dim hasFilter As Boolean
    hasFilter = isTopLevel And Not IsMissing(filterKeys)

    ' ── 情況①：Null / Empty ───────────────────────────────
    If IsNull(val) Or IsEmpty(val) Then
        ToCompactJsonInner = ""
        Exit Function
    End If

    ' ── 情況②：通常の VBA Array ───────────────────────────
    If IsArray(val) Then
        Dim arrParts() As String
        Dim arrCount As Long
        arrCount = 0
        ReDim arrParts(LBound(val) To UBound(val))
        
        For i = LBound(val) To UBound(val)
            Dim arrItem As String
            arrItem = ToCompactJsonInner(val(i), sc)
            If arrItem <> "" Then
                arrParts(arrCount) = arrItem
                arrCount = arrCount + 1
            End If
        Next i
        
        If arrCount = 0 Then
            ToCompactJsonInner = "[]"
        Else
            ReDim Preserve arrParts(0 To arrCount - 1)
            ToCompactJsonInner = "[" & Join(arrParts, ",") & "]"
        End If

    ' ── 情況③：Dictionary ─────────────────────────────────
    ElseIf TypeName(val) = "Dictionary" Then
        Dim objParts() As String
        Dim objCount As Long
        objCount = 0
        ReDim objParts(0 To val.Count - 1)
        
        For Each key In val.Keys
            If hasFilter Then
                Dim keyFound As Boolean
                keyFound = False
                Dim j As Long
                For j = LBound(filterKeys) To UBound(filterKeys)
                    If StrComp(CStr(key), CStr(filterKeys(j)), vbTextCompare) = 0 Then
                        keyFound = True
                        Exit For
                    End If
                Next j
                If Not keyFound Then GoTo SkipDictKey
            End If
            
            Dim dictVal As String
            dictVal = ToCompactJsonInner(val(key), sc)
            If dictVal <> "" Then
                objParts(objCount) = """" & CStr(key) & """:" & dictVal
                objCount = objCount + 1
            End If
SkipDictKey:
        Next key
        
        If objCount = 0 Then
            ToCompactJsonInner = "{}"
        Else
            ReDim Preserve objParts(0 To objCount - 1)
            ToCompactJsonInner = "{" & Join(objParts, ",") & "}"
        End If

    ' ── 情況④：JScriptTypeInfo ────────────────────────────
    ElseIf TypeName(val) = "JScriptTypeInfo" Then
    
        ' length があれば配列、なければ Object
        Dim testLen As Variant
        testLen = Empty
        On Error Resume Next
        testLen = CallByName(val, "length", VbGet)
        On Error GoTo 0
        
        If Not IsEmpty(testLen) And Not IsNull(testLen) And CLng(testLen) >= 0 Then
            ' ── JScriptTypeInfo の配列処理 ──────────────
            Dim jsArrParts() As String
            Dim jsArrCount As Long
            jsArrCount = 0
            Dim jsLen As Long
            jsLen = CLng(testLen)
            
            If jsLen = 0 Then
                ToCompactJsonInner = "[]"
                Exit Function
            End If
            
            ReDim jsArrParts(0 To jsLen - 1)
            
            For i = 0 To jsLen - 1
                Dim elem As Variant
                elem = Empty
                On Error Resume Next
                elem = CallByName(val, CStr(i), VbGet)
                On Error GoTo 0
                
                ' ★ ここが重要：elem も JScriptTypeInfo の可能性があるので
                '   ToCompactJsonInner を再帰呼び出しする
                '   sc を渡すので毎回 CreateObject しない
                Dim jsArrItem As String
                jsArrItem = ToCompactJsonInner(elem, sc)
                
                If jsArrItem <> "" Then
                    jsArrParts(jsArrCount) = jsArrItem
                    jsArrCount = jsArrCount + 1
                End If
            Next i
            
            If jsArrCount = 0 Then
                ToCompactJsonInner = "[]"
            Else
                ReDim Preserve jsArrParts(0 To jsArrCount - 1)
                ToCompactJsonInner = "[" & Join(jsArrParts, ",") & "]"
            End If
            
        Else
            ' ── JScriptTypeInfo の Object 処理 ───────────
            ' filterKeys があればそれだけ、なければ API_KEYS を使う
            Dim knownKeys() As String
            
            If hasFilter Then
                ReDim knownKeys(LBound(filterKeys) To UBound(filterKeys))
                Dim fi As Long
                For fi = LBound(filterKeys) To UBound(filterKeys)
                    knownKeys(fi) = CStr(filterKeys(fi))
                Next fi
            Else
                ' ★ ここに実際のキー一覧を書く
                knownKeys = Split("type,coordinates", ",")
            End If
            
            Dim jsParts() As String
            Dim jsCount As Long
            jsCount = 0
            ReDim jsParts(0 To UBound(knownKeys))
            
            Dim ki As Long
            For ki = 0 To UBound(knownKeys)
                Dim jsKey As String
                jsKey = Trim(knownKeys(ki))
                
                Dim jsVal As Variant
                jsVal = Empty
                On Error Resume Next
                jsVal = CallByName(val, jsKey, VbGet)
                On Error GoTo 0
                
                If IsEmpty(jsVal) Then GoTo SkipJsKey
                
                Dim jsValStr As String
                jsValStr = ToCompactJsonInner(jsVal, sc)
                
                If jsValStr <> "" Then
                    jsParts(jsCount) = """" & jsKey & """:" & jsValStr
                    jsCount = jsCount + 1
                End If
SkipJsKey:
            Next ki
            
            If jsCount = 0 Then
                ToCompactJsonInner = "{}"
            Else
                ReDim Preserve jsParts(0 To jsCount - 1)
                ToCompactJsonInner = "{" & Join(jsParts, ",") & "}"
            End If
        End If

    ' ── 情況⑤：Boolean ────────────────────────────────────
    ElseIf TypeName(val) = "Boolean" Then
        ToCompactJsonInner = IIf(val, "true", "false")

    ' ── 情況⑥：数字 ──────────────────────────────────────
    ElseIf IsNumeric(val) Then
        ToCompactJsonInner = CStr(val)

    ' ── 情況⑦：文字列 ────────────────────────────────────
    Else
        Dim s As String
        s = CStr(val)
        s = Replace(s, "\", "\\")
        s = Replace(s, """", "\""")
        s = Replace(s, Chr(10), "\n")
        s = Replace(s, Chr(13), "\r")
        s = Replace(s, Chr(9), "\t")
        ToCompactJsonInner = """" & s & """"
    End If

End Function
