# Configuração OAuth Google - GoAtleta

## ✅ O que foi feito

### 1. **Correção de Erro (AnchoredDropdown)**
- **Arquivo**: `app/students/index.tsx`
- **Problema**: Import duplicado de `AnchoredDropdown` causava erro de build
- **Solução**: Aliasado para `StudentsAnchoredDropdown`

### 2. **Google Cloud Console - OAuth Setup**

#### Credentials
- **Client ID**: `382671683805-9qrk0n6hm4765g3093mlt1o3g60frtkg.apps.googleusercontent.com`
- **Client Secret**: `****-d-oS` (configurado no Supabase)

#### Authorized redirect URIs (3 URLs)
```
https://hgmdpetpwclucvquoklv.supabase.co/auth/v1/callback
https://go-atleta.vercel.app
http://localhost:8081
```

#### OAuth consent screen
- **Authorized domains** (2):
  - `hgmdpetpwclucvquoklv.supabase.co`
  - `go-atleta.vercel.app`

- **Publishing status**: Testing (mantido - até 100 test users grátis)

### 3. **Supabase - Authentication**

#### URL Configuration
- **Site URL**: `https://go-atleta.vercel.app`
- **Redirect URLs** (4):
  - `https://go-atleta.vercel.app/**`
  - `https://go-atleta.vercel.app/auth-callback`
  - `http://localhost:3000/**`
  - `http://localhost:8081/**`

#### Google Provider
- Client ID e Secret configurados
- OAuth funcionando ✅

### 4. **Deep Links Mobile**
- **Arquivo**: `app.config.js`
- **Adicionado**:
  - iOS: `associatedDomains` com `go-atleta.vercel.app`
  - Android: `intentFilters` para abrir links HTTPS no app
- **Scheme**: `goatleta://` (já existia)

### 5. **Deploy**
- Código commitado e pushed para GitHub
- Vercel faz deploy automático
- URL: https://go-atleta.vercel.app

## 📋 Próximos Passos

### Imediato
1. **Adicionar test users** no Google Cloud Console:
   - OAuth consent screen → Test users → + ADD USERS
   - Adicionar emails dos professores/alunos (até 100)

2. **Testar no Vercel**:
   - Acessar https://go-atleta.vercel.app/login
   - Login com Google deve funcionar

### Para Mobile (APK/IPA)
1. **Rebuild com deep links**:
   ```bash
   eas build --platform android --profile production
   ```

2. **Instalar novo APK** no celular

3. **Testar**:
   - Login com Google no app
   - Links de convite abrem direto no app

### Opcional (Futuro)
- Publicar OAuth para todos (requer billing no Google Cloud)
- Configurar Apple Sign In
- Configurar Facebook Login

## 🔧 Comandos Úteis

```bash
# Iniciar dev server
npm start

# Build Android
eas build --platform android --profile production

# Build iOS
eas build --platform ios --profile production

# Ver logs do Vercel
vercel logs go-atleta

# Adicionar variáveis de ambiente
vercel env add EXPO_PUBLIC_SUPABASE_URL
```

## 🔗 Links Importantes

- **App Produção**: https://go-atleta.vercel.app
- **Supabase Dashboard**: https://supabase.com/dashboard/project/hgmdpetpwclucvquoklv
- **Google Cloud Console**: https://console.cloud.google.com
- **Vercel Dashboard**: https://vercel.com
- **GitHub Repo**: https://github.com/otaldogusta/GoAtleta

## ⚠️ Importante Lembrar

1. **OAuth em Testing**: Só emails adicionados como "test users" conseguem fazer login
2. **Deep links**: Só funcionam após rebuild do app mobile
3. **Site URL no Supabase**: Configurado para produção (`go-atleta.vercel.app`)
4. **Localhost**: Continua funcionando para desenvolvimento
