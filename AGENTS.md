# Convenciones del Proyecto

## Commits

Los mensajes de commit deben seguir las convenciones de [Conventional Commits](https://www.conventionalcommits.org/) y estar **en inglés**.

### Tipos de commit

- `feat`: Nueva funcionalidad
- `fix`: Corrección de bug
- `docs`: Cambios en documentación
- `style`: Cambios de formato (espacios, comas, etc. sin cambiar código)
- `refactor`: Refactorización del código
- `test`: Agregar o modificar tests
- `chore`: Tareas de mantenimiento (actualizar dependencias, caches, etc.)

### Formato

```
<type>: <descripción corta en imperativo>

[Cuerpo opcional con más detalles]
```

### Reglas

- **Atómicos**: Un commit = Una funcionalidad/cambio lógico
- **Separados**: No agrupar cambios no relacionados
- **Idioma**: Inglés para commits, español para documentación

```bash
# Malo - todo junto en un commit
feat: add EMAE, update BMA cache, fix bug in chart, add new button

# Bueno - commits separados
feat: add EMAE indicator with three series
chore: update BMA cache with recent data
fix: correct chart axis calculation
feat: add download button to chart view
```

### Reglas de trabajo

- **NO hacer commits sin orden expresa del usuario**
- Esperar siempre la orden "commit" o "hacer commit" antes de ejecutar git commit

## Código

### Principios

**Código minimalista**: La mejor pieza de código es la que no existe. Menos código = menos bugs = más fácil de mantener.

```typescript
// Malo - código innecesario
function isAdult(age: number): boolean {
    if (age >= 18) {
        return true;
    } else {
        return false;
    }
}

// Bueno - minimalista
const isAdult = (age: number) => age >= 18;
```

**Sin comentarios**: El código debe ser autoexplicativo. Si necesitás comentarios, el código no está bien escrito.

```typescript
// Malo - necesita comentario para entender
let x = 1000; // convert to seconds
const y = x / 60;

// Bueno - nombre claro elimina necesidad de comentario
const MINUTES_TO_SECONDS = 60;
const totalSeconds = minutes * MINUTES_TO_SECONDS;
```

**Mensajes de error claros**: Siempre que lances un error, explicá qué pasó y cómo arreglarlo.

```typescript
// Malo - error vago
throw new Error('Error');

// Bueno - error claro con contexto
throw new Error(`Failed to fetch user ${userId}. User not found in database. Verify the user exists.`);
```

**Nombres claros**: Usá nombres descriptivos para variables, funciones y clases. Evitá abreviaciones confusas.

```typescript
// Malo - abreviaciones confusas
const dt = users.filter(u => u.a > 18);
const calc = (p, r, t) => p * (1 + r * t);

// Buenos - nombres descriptivos
const adults = users.filter(user => user.age > 18);
const calculateSimpleInterest = (principal, rate, time) => principal * (1 + rate * time);
```

**Funciones pequeñas**: Cada función debe hacer una sola cosa y hacerlo bien.

```typescript
// Malo - función que hace muchas cosas
function saveUserAndSendEmail(user) {
    // Validar usuario
    if (!user.email.includes('@')) {
        return { error: 'Invalid email' };
    }
    if (user.name.length < 2) {
        return { error: 'Name too short' };
    }
    
    // Guardar en base de datos
    database.save(user);
    
    // Enviar email de bienvenida
    sendEmail(user.email, 'Welcome!');
    
    // Actualizar estadísticas
    stats.increment('new_users');
    
    // Loggear actividad
    logger.log('new_user', user.id);
    
    return { success: true };
}

// Bueno - cada función hace una sola cosa
function saveUser(user) {
    if (!isValidUser(user)) throw new Error('Invalid user');
    return database.save(user);
}

function isValidUser(user) {
    return user.email.includes('@') && user.name.length >= 2;
}

async function registerUser(user) {
    await saveUser(user);
    await sendWelcomeEmail(user.email);
    await updateUserStats();
}
```

**Máximo 3 niveles de indentación**: Si necesitás más, refactorizá tu código.

```typescript
// Malo - más de 3 niveles de indentación
function processData(data) {
    if (data) {
        if (data.items) {
            if (data.items.length > 0) {
                for (let i = 0; i < data.items.length; i++) {
                    if (data.items[i].valid) {
                        processItem(data.items[i]);
                    }
                }
            }
        }
    }
}

// Bueno - returns tempranos y menos niveles
function processData(data) {
    if (!data) return;
    if (!data.items?.length) return;
    
    for (const item of data.items) {
        if (item.valid) processItem(item);
    }
}
```

**Returns tempranos**: Evitan procesar código innecesario.

```typescript
// Malo - indentación innecesaria
function getUser(id) {
    if (id) {
        const user = database.find(id);
        if (user) {
            return user;
        } else {
            return null;
        }
    } else {
        return null;
    }
}

// Bueno - return temprano
function getUser(id) {
    if (!id) return null;
    const user = database.find(id);
    return user ?? null;
}
```

**Async/await**: Priorizá el uso de async/await sobre callbacks.

```typescript
// Malo - callback hell
function getUserData(userId, callback) {
    if (userId) {
        database.query('SELECT * FROM users WHERE id = ?', [userId], function(err, user) {
            if (err) {
                callback(err);
            } else {
                if (user) {
                    callback(null, user);
                } else {
                    callback(new Error('User not found'));
                }
            }
        });
    } else {
        callback(new Error('Invalid userId'));
    }
}

// Bueno - async/await limpio
async function getUserData(userId: string): Promise<User> {
    if (!userId) throw new Error('Invalid userId');
    
    const user = await database.query('SELECT * FROM users WHERE id = ?', [userId]);
    if (!user) throw new Error('User not found');
    
    return user;
}
```
