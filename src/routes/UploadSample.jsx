import React, { useState } from "react";
import {
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Paper,
} from "@mui/material";

export default function Upload() {
  const [rows, setRows] = useState([]);

  const handleUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = (event) => {
      const text = event.target.result;

      // split rows by newline
      const lines = text.trim().split("\n");

      // get headers
      const headers = lines[0].split(",");

      // parse body
      const data = lines.slice(1).map((line) => {
        const values = line.split(",");
        return headers.reduce((obj, header, index) => {
          obj[header.trim()] = values[index]?.trim();
          return obj;
        }, {});
      });

      setRows(data);
    };

    reader.readAsText(file);
  };

  return (
    <Paper sx={{ p: 2 }}>
      <Button variant="contained" component="label">
        Upload CSV
        <input
          type="file"
          accept=".csv"
          hidden
          onChange={handleUpload}
        />
      </Button>

      {rows.length > 0 && (
        <Table sx={{ mt: 2 }}>
          <TableHead>
            <TableRow>
              {Object.keys(rows[0]).map((key) => (
                <TableCell key={key}>{key}</TableCell>
              ))}
            </TableRow>
          </TableHead>

          <TableBody>
            {rows.map((row, index) => (
              <TableRow key={index}>
                {Object.values(row).map((value, i) => (
                  <TableCell key={i}>{value}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Paper>
  );
}
