import { useMemo, useEffect  } from 'react';
import {
  TextField,
  Button,
  Box,
  Alert,
  Stack,
  Typography,
  MenuItem,
  IconButton,
  Grid,
} from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { schema } from './validationSchema';
import { useNavigate, useLocation } from "react-router-dom";
import './form.css';
import DeleteIcon from '@mui/icons-material/Delete';
import { styled } from '@mui/material/styles';
import Paper from '@mui/material/Paper';

const Item = styled(Paper)(({ theme }) => ({
  // backgroundColor: '#fff',
  // ...theme.typography.body2,
  // padding: theme.spacing(1),
  textAlign: 'center',
  // color: (theme.vars ?? theme).palette.text.secondary,
  // ...theme.applyStyles('dark', {
  //   backgroundColor: '#1A2027',
  // }),
}));

export default function SampleForm() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const FIELD_ORDER = [
    'name',
    'email',
    'age',
    'gender',
    'zipcode',
  ];

  const getDefaultValue = () => {
    return Object.fromEntries(
      FIELD_ORDER.map((key) => [key, state?.[key] ?? ''])
    )
  }

  const defaultValues = getDefaultValue();

  console.log('defaultValues', defaultValues);

  const {
    register,
    handleSubmit,
    trigger,
    formState: { errors },
    control,
    setValue,
    getValues,
    reset,
  } = useForm({
    resolver: yupResolver(schema),
    mode: 'onBlur', // onChange
    // reValidateMode: 'onChange', // onBlur
    // shouldUnregister: false, 
    defaultValues
  });


  /* 🔥 關鍵：state 來了就 reset */
  useEffect(() => {
    if (state) {
      reset(getDefaultValue());
    }
  }, [state, reset]);

  // const { errors } = useFormState({ control });

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

  const handleZipcodeSearch = async () => {
    // 🔒 先驗證 zipcode 欄位
    const isValid = await trigger('zipcode');
    if (!isValid) return;

    const zipcode = getValues('zipcode');

    try {
      const res = await fetch(
        `https://zipcloud.ibsnet.co.jp/api/search?zipcode=${zipcode}`
      );
      const data = await res.json();

      if (!data.results || data.results.length === 0) {
        alert('查無地址');
        setValue('prefecture', "");
        setValue('city', "");
        return;
      }

      const result = data.results[0];

      // 🔥 填入 RHF（trigger re-render / errorDeps）
      setValue('prefecture', result.address1, {
        shouldDirty: true,
      });
      setValue('city', result.address2 + result.address3, {
        shouldDirty: true,
      });
    } catch (e) {
      alert('查詢失敗');
    }
  };

  const items = [
    {
      number: 1,
      code: 'ID001',
      name: '範例名',
      url: 'google.com',
    },
    {
      number: 2,
      code: 'ID002',
      name: '第二筆',
      url: 'example.com',
    },
  ];

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

          <Controller
            name="gender"
            control={control}
            render={({ field }) => (
              <TextField
                select
                label="性別"
                {...field}
                error={!!errors.gender}
                helperText={errors.gender?.message}
              >
                <MenuItem value="">請選擇</MenuItem>
                <MenuItem value="male">男</MenuItem>
                <MenuItem value="female">女</MenuItem>
              </TextField>
            )}
          />

          {/* <TextField
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
          </TextField> */}

          <Stack direction="row" spacing={1}>
            <TextField
              label="郵便番号（7桁）"
              error={!!errors.zipcode}
              helperText={errors.zipcode?.message}
              inputProps={{ maxLength: 7 }}
              {...register('zipcode')}
            />
            <Button variant="contained" onClick={handleZipcodeSearch}>
              查詢
            </Button>
          </Stack>

          <TextField
            label="都道府県"
            disabled
            className="disabled-field"
            InputLabelProps={{ shrink: true }}
            {...register('prefecture')}
          />

          <TextField
            label="市区町村"
            disabled
            className="disabled-field"
            InputLabelProps={{ shrink: true }}
            {...register('city')}
          />

          <Box sx={{ width: '100%' }}>
            {items.map((item) => (
              <Grid container spacing={2}>
                <Grid size={8}>
                  <div style={{textAlign: 'center', background: 'gray'}}>size=8</div>
                </Grid>
                <Grid size={4}>
                  <div style={{textAlign: 'center', background: 'gray'}}>size=4</div>
                </Grid>
                <Grid size={4}>
                  <div style={{textAlign: 'center', background: 'gray'}}>size=4</div>
                </Grid>
                <Grid size={8}>
                  <div style={{textAlign: 'center', background: 'gray'}}>size=8</div>
                </Grid>
              </Grid>
            ))}
          </Box>

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
