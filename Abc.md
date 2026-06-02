Function ToJson(v As Variant) As String

    If IsObject(v) Then
        ToJson = ObjectToJson(v)

    ElseIf IsArray(v) Then
        ToJson = ArrayToJson(v)

    ElseIf IsNull(v) Then
        ToJson = "null"

    ElseIf VarType(v) = vbString Then
        ToJson = """" & EscapeJson(CStr(v)) & """"

    ElseIf VarType(v) = vbBoolean Then
        ToJson = LCase(CStr(v))

    Else
        ToJson = CStr(v)
    End If

End Function

Function ObjectToJson(dict As Object) As String

    Dim key As Variant
    Dim result As String

    result = "{"

    For Each key In dict.Keys

        If Not IsNull(dict(key)) Then

            If Right(result, 1) <> "{" Then
                result = result & ","
            End If

            result = result _
                & """" & key & """:" _
                & ToJson(dict(key))

        End If

    Next key

    result = result & "}"

    ObjectToJson = result

End Function


Function ArrayToJson(arr As Variant) As String

    Dim i As Long
    Dim result As String

    result = "["

    For i = LBound(arr) To UBound(arr)

        If i > LBound(arr) Then
            result = result & ","
        End If

        result = result & ToJson(arr(i))

    Next i

    result = result & "]"

    ArrayToJson = result

End Function

Function EscapeJson(str As String) As String

    str = Replace(str, "\", "\\")
    str = Replace(str, """", "\""")
    str = Replace(str, vbCrLf, "\n")
    str = Replace(str, vbCr, "\n")
    str = Replace(str, vbLf, "\n")

    EscapeJson = str

End Function
