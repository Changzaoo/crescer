# Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Permitir leitura pública do conteúdo
    match /app/content {
      allow read: if true;
      allow write: if false; // Apenas via autenticação no frontend
    }
    
    // Proteger credenciais - apenas leitura via código
    match /app/credentials {
      allow read, write: if false; // Acesso apenas via código
    }
    
    // Negar acesso a outros documentos
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

## Como aplicar:

1. Acesse o Firebase Console
2. Vá para Firestore Database
3. Clique em "Rules"
4. Cole o código acima
5. Clique em "Publish"

> **Nota**: Estas regras permitem leitura pública do conteúdo mas protegem as credenciais. A escrita é controlada pelo código da aplicação.