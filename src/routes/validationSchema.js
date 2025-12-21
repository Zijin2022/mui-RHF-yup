import * as yup from 'yup';

export const schema = yup.object({
  name: yup.string().trim().required('姓名為必填'),
  email: yup
    .string().trim()
    .email('Email 格式錯誤')
    .required('Email 為必填'),
  age: yup
    .number()
    .typeError('年齡必須是數字')
    .min(18, '必須年滿 18 歲')
    .required('年齡為必填'),
  gender: yup.string().required('請選擇性別'),
  zipcode: yup
    .string()
    .required('郵便番号は必須です')
    .matches(/^\d{7}$/, '郵便番号は7桁の数字で入力してください'),
});
