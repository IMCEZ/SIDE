export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export function isValidUrl(url: string): boolean {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

export function isValidJson(str: string): boolean {
  try {
    JSON.parse(str)
    return true
  } catch {
    return false
  }
}

export function isValidApiKey(key: string): boolean {
  return key.length >= 10
}

export function isValidModelName(name: string): boolean {
  return name.length > 0 && /^[a-zA-Z0-9\-_./:]+$/.test(name)
}

export function validatePassword(password: string): { valid: boolean; message?: string } {
  if (password.length < 6) {
    return { valid: false, message: '密码长度至少为6位' }
  }
  if (password.length > 128) {
    return { valid: false, message: '密码长度不能超过128位' }
  }
  return { valid: true }
}

export function validateRequired(value: unknown, fieldName: string): { valid: boolean; message?: string } {
  if (value === undefined || value === null || value === '') {
    return { valid: false, message: `${fieldName}不能为空` }
  }
  return { valid: true }
}

export function validateMaxLength(value: string, maxLength: number, fieldName: string): { valid: boolean; message?: string } {
  if (value.length > maxLength) {
    return { valid: false, message: `${fieldName}不能超过${maxLength}个字符` }
  }
  return { valid: true }
}

export function validateRange(value: number, min: number, max: number, fieldName: string): { valid: boolean; message?: string } {
  if (value < min || value > max) {
    return { valid: false, message: `${fieldName}必须在${min}到${max}之间` }
  }
  return { valid: true }
}
