import { useMemo } from 'react';
import {
  TextField,
  Button,
  Box,
  Alert,
  Stack,
  Typography,
  MenuItem,
} from '@mui/material';
import { useForm, useFormState } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { schema } from './validationSchema';
import { useNavigate } from "react-router-dom";

export default function SampleForm() {
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors },
    // control
  } = useForm({
    resolver: yupResolver(schema),
    mode: 'onBlur', // onChange
    // reValidateMode: 'onChange', // onBlur
    // shouldUnregister: false, 
    // defaultValues: {
    //   name: '',
    //   email: '',
    //   age: '',
    //   gender: '',
    // },
  });

  // const { errors } = useFormState({ control });

  const FIELD_ORDER = [
    'name',
    'email',
    'age',
  ];

  const errorDeps = FIELD_ORDER.map(
    field => errors[field]?.message
  );

  /* 將 errors 轉成有順序的錯誤清單（編號用） */
  const errorList = useMemo(() => {
    // console.log('errors from useFormState', errors);
    return FIELD_ORDER
      .filter(field => errors[field])
      .map((field, index) => ({
        index: index + 1,
        field,
        message: errors[field]?.message ?? '',
      }));
  }, [errorDeps]);

  /* 建立 field → 錯誤編號 對照表 */
  const errorIndexMap = useMemo(() => {
    return errorList.reduce((acc, cur) => {
      acc[cur.field] = cur.index;
      return acc;
    }, {});
  }, [errorList]);

  const onSubmit = data => {
    console.log('submit success:', data);
  };

  return (
    <Box sx={{ maxWidth: 480, mx: 'auto', margin: "10px" }}>
      {/* 🔴 固定在上方的錯誤 Banner */}
      {errorList.length > 0 && (
        <Alert
          severity="error"
          sx={{
            position: 'sticky',
            top: 0,
            zIndex: 10,
            mb: 2,
          }}
        >
          <Stack spacing={0.5}>
            <Typography fontWeight="bold">
              表單有以下錯誤：
            </Typography>

            {errorList.map(err => (
              <Typography key={err.field} variant="body2">
                {err.index}. {err.field}：{err.message}
              </Typography>
            ))}
          </Stack>
        </Alert>
      )}
      <form onSubmit={handleSubmit(onSubmit)} noValidate style={{margin:"10px"}}>
        <Stack spacing={3}>
          <TextField
            label={
              errorIndexMap.name
                ? `${errorIndexMap.name}. 姓名`
                : '姓名'
            }
            error={!!errors.name}
            helperText={errors.name?.message}
            {...register('name')}
          />
          <TextField
            label={
              errorIndexMap.email
                ? `${errorIndexMap.email}. Email`
                : 'Email'
            }
            error={!!errors.email}
            helperText={errors.email?.message}
            {...register('email')}
          />
          <TextField
            label={
              errorIndexMap.age
                ? `${errorIndexMap.age}. 年齡`
                : '年齡'
            }
            error={!!errors.age}
            helperText={errors.age?.message}
            {...register('age', { valueAsNumber: true })}
          />

          <TextField
            select
            label="性別"
            error={!!errors.gender}
            helperText={errors.gender?.message}
            {...register('gender')}
            // {...genderRegister}
            // onChange={(e) => {
            //   genderRegister.onChange(e); // 🔥 交還給 RHF
            //   // 自己的邏輯
            // }}
          >
            <MenuItem value="">請選擇</MenuItem>
            <MenuItem value="male">男</MenuItem>
            <MenuItem value="female">女</MenuItem>
          </TextField>

          <Button type="submit" variant="contained">
            送出
          </Button>
        </Stack>
      </form>
      <button onClick={() => navigate("/")} style={{margin: "10px"}}>
        Go to HOME
      </button>
    </Box>
  );
}
