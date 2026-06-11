'================================================================================
' Module: JsonHelper
' Purpose: Deep-get a value from a JScriptTypeInfo nested object by dot-path key
'          Returns the value as String; nested objects are compacted JSON strings
'================================================================================
Option Explicit

' -----------------------------------------------------------------------
' Public API
' -----------------------------------------------------------------------

''' GetByPath("root.child.key", jsObj)
''' Supports dot-notation path: "level1.level2.key"
Public Function GetByPath(ByVal keyPath As String, ByVal obj As Object) As String
    Dim parts() As String
    parts = Split(keyPath, ".")

    Dim current As Object
    Set current = obj

    Dim i As Long
    For i = 0 To UBound(parts)
        If current Is Nothing Then
            GetByPath = ""
            Exit Function
        End If

        Dim part As String
        part = Trim(parts(i))

        If Not HasKey(current, part) Then
            GetByPath = ""
            Exit Function
        End If

        Dim raw As Variant
        raw = GetProp(current, part)

        If i = UBound(parts) Then
            ' Terminal node — format and return
            GetByPath = FormatValue(raw)
        Else
            ' Intermediate node — must be an object to keep drilling
            If IsObject(raw) Then
                Set current = raw
            Else
                GetByPath = ""
                Exit Function
            End If
        End If
    Next i
End Function

''' Serialise any JScriptTypeInfo value to a compact JSON string
Public Function Stringify(ByVal val As Variant) As String
    Stringify = FormatValue(val)
End Function

' -----------------------------------------------------------------------
' Private helpers
' -----------------------------------------------------------------------

''' Recursively format a variant into a JSON-compatible string
Private Function FormatValue(ByVal val As Variant) As String
    If IsObject(val) Then
        If val Is Nothing Then
            FormatValue = "null"
        Else
            FormatValue = ObjectToJson(val)
        End If
    ElseIf IsNull(val) Then
        FormatValue = "null"
    ElseIf IsEmpty(val) Then
        FormatValue = "null"
    ElseIf VarType(val) = vbBoolean Then
        FormatValue = IIf(val, "true", "false")
    ElseIf VarType(val) = vbString Then
        ' If the string is itself JSON, compact it; otherwise return as-is
        Dim trimmed As String
        trimmed = Trim(CStr(val))
        If IsJsonString(trimmed) Then
            FormatValue = CompactJson(trimmed)
        Else
            FormatValue = trimmed
        End If
    ElseIf IsNumeric(val) Then
        FormatValue = CStr(val)
    Else
        FormatValue = Trim(CStr(val))
    End If
End Function

''' Serialise a JScriptTypeInfo object → compact JSON object or array string
Private Function ObjectToJson(ByVal obj As Object) As String
    ' Arrays: JScript arrays expose a "length" property
    If HasKey(obj, "length") Then
        Dim arrLen As Long
        On Error Resume Next
        arrLen = CLng(GetProp(obj, "length"))
        On Error GoTo 0

        If arrLen >= 0 Then
            ObjectToJson = ArrayToJson(obj, arrLen)
            Exit Function
        End If
    End If

    ObjectToJson = ObjToJsonObject(obj)
End Function

Private Function ArrayToJson(ByVal obj As Object, ByVal length As Long) As String
    If length = 0 Then
        ArrayToJson = "[]"
        Exit Function
    End If

    Dim parts() As String
    ReDim parts(0 To length - 1)

    Dim i As Long
    For i = 0 To length - 1
        Dim elem As Variant
        elem = GetProp(obj, CStr(i))
        If IsObject(elem) Then
            parts(i) = ObjectToJson(elem)
        Else
            parts(i) = JsonValueLiteral(elem)
        End If
    Next i

    ArrayToJson = "[" & Join(parts, ",") & "]"
End Function

Private Function ObjToJsonObject(ByVal obj As Object) As String
    ' Enumerate keys via JScript Object.keys()
    Dim sc As Object
    Set sc = CreateObject("ScriptControl")
    sc.Language = "JScript"

    Dim keysJson As String
    On Error Resume Next
    keysJson = sc.Eval("JSON.stringify(Object.keys(arguments[0]))", obj)
    On Error GoTo 0

    If Len(keysJson) = 0 Then
        ObjToJsonObject = "{}"
        Exit Function
    End If

    ' keysJson is a JSON array string like ["a","b","c"]
    ' Strip brackets and quotes manually for compatibility
    keysJson = Mid(keysJson, 2, Len(keysJson) - 2) ' remove [ ]
    If Len(keysJson) = 0 Then
        ObjToJsonObject = "{}"
        Exit Function
    End If

    Dim rawKeys() As String
    rawKeys = Split(keysJson, ",")

    Dim pairs() As String
    ReDim pairs(0 To UBound(rawKeys))

    Dim k As Long
    For k = 0 To UBound(rawKeys)
        Dim keyName As String
        keyName = Trim(rawKeys(k))
        ' Strip surrounding quotes from key
        If Left(keyName, 1) = """" Then keyName = Mid(keyName, 2, Len(keyName) - 2)

        Dim propVal As Variant
        propVal = GetProp(obj, keyName)

        Dim valStr As String
        If IsObject(propVal) Then
            valStr = ObjectToJson(propVal)
        Else
            valStr = JsonValueLiteral(propVal)
        End If

        pairs(k) = """" & EscapeJsonString(keyName) & """:" & valStr
    Next k

    ObjToJsonObject = "{" & Join(pairs, ",") & "}"
End Function

''' Format a scalar value as a proper JSON literal
Private Function JsonValueLiteral(ByVal val As Variant) As String
    If IsNull(val) Or IsEmpty(val) Then
        JsonValueLiteral = "null"
    ElseIf VarType(val) = vbBoolean Then
        JsonValueLiteral = IIf(val, "true", "false")
    ElseIf IsNumeric(val) Then
        JsonValueLiteral = CStr(val)
    Else
        Dim s As String
        s = Trim(CStr(val))
        If IsJsonString(s) Then
            JsonValueLiteral = CompactJson(s)
        Else
            JsonValueLiteral = """" & EscapeJsonString(s) & """"
        End If
    End If
End Function

''' Compact a JSON string: remove redundant whitespace outside of string values
Private Function CompactJson(ByVal json As String) As String
    Dim sc As Object
    Set sc = CreateObject("ScriptControl")
    sc.Language = "JScript"

    Dim result As String
    On Error Resume Next
    result = sc.Eval("JSON.stringify(JSON.parse(" & WrapJsString(json) & "))")
    On Error GoTo 0

    If Len(result) = 0 Then
        ' Fallback: return trimmed original if parse failed
        CompactJson = Trim(json)
    Else
        CompactJson = result
    End If
End Function

''' Safely read a property from a JScriptTypeInfo object
Private Function GetProp(ByVal obj As Object, ByVal key As String) As Variant
    On Error Resume Next
    Dim v As Variant
    v = CallByName(obj, key, VbGet)
    If Err.Number <> 0 Then
        Err.Clear
        GetProp = Empty
        Exit Function
    End If
    On Error GoTo 0

    If IsObject(v) Then
        Set GetProp = v
    Else
        GetProp = v
    End If
End Function

''' Check if an object has a given property key
Private Function HasKey(ByVal obj As Object, ByVal key As String) As Boolean
    On Error Resume Next
    Dim v As Variant
    v = CallByName(obj, key, VbGet)
    HasKey = (Err.Number = 0)
    Err.Clear
    On Error GoTo 0
End Function

''' Detect whether a string looks like a JSON object or array
Private Function IsJsonString(ByVal s As String) As Boolean
    Dim c As String
    c = Left(Trim(s), 1)
    IsJsonString = (c = "{" Or c = "[")
End Function

''' Escape special characters for JSON string values
Private Function EscapeJsonString(ByVal s As String) As String
    s = Replace(s, "\", "\\")
    s = Replace(s, """", "\""")
    s = Replace(s, Chr(8), "\b")
    s = Replace(s, Chr(9), "\t")
    s = Replace(s, Chr(10), "\n")
    s = Replace(s, Chr(12), "\f")
    s = Replace(s, Chr(13), "\r")
    EscapeJsonString = s
End Function

''' Wrap a VBA string for safe use as a JS string literal
Private Function WrapJsString(ByVal s As String) As String
    s = Replace(s, "\", "\\")
    s = Replace(s, "'", "\'")
    WrapJsString = "'" & s & "'"
End Function

---

Sub Demo()
    ' --- Setup: parse some JSON into a JScriptTypeInfo object ---
    Dim sc As Object
    Set sc = CreateObject("ScriptControl")
    sc.Language = "JScript"

    Dim jsObj As Object
    Set jsObj = sc.Eval("({user:{name:'Azusa',address:{city:'Tokyo',zip:'100-0001'},tags:['vba','js']},active:true})")

    ' --- GetByPath examples ---
    Debug.Print GetByPath("user.name", jsObj)
    '→ Azusa

    Debug.Print GetByPath("user.address.city", jsObj)
    '→ Tokyo

    Debug.Print GetByPath("user.address", jsObj)
    '→ {"city":"Tokyo","zip":"100-0001"}

    Debug.Print GetByPath("user.tags", jsObj)
    '→ ["vba","js"]

    Debug.Print GetByPath("active", jsObj)
    '→ true

    Debug.Print GetByPath("user.missing", jsObj)
    '→  (empty string)

    ' --- Stringify a whole object ---
    Debug.Print Stringify(jsObj)
    '→ {"user":{"name":"Azusa","address":{"city":"Tokyo","zip":"100-0001"},"tags":["vba","js"]},"active":true}
End Sub

