# Plan: la parrilla del día (2 actualidad + 2 curiosidades)

## Qué pasó, con los datos delante

Siete notas seguidas de curiosidades y efemérides, cero de actualidad desde el 24 de agosto. Dos
causas, las dos demostradas:

1. **Fallo aritmético en el reparto.** `elegirGenero` hacía `notasHoy % 10 < 4`. Con tres notas al
   día el contador vale 0, 1 y 2 — y los tres son menores que 4, así que **siempre** salía «propia».
   El reparto 40/60 se pensó sobre diez notas seguidas, pero se reinicia cada día en cero y nunca
   llegaba al umbral.
2. **La efeméride mandaba sobre todo.** `if (hayEfemerideRedonda) return "efemeride"` iba antes que
   cualquier otra cosa, y hay aniversarios redondos casi a diario.

## El arreglo: una escaleta, no un porcentaje

Un porcentaje que se calcula sobre un contador que se reinicia es frágil por diseño. Una redacción
no trabaja así: trabaja con una **escaleta** — cada franja tiene su género asignado de antemano.

| Franja   | Hora (Este) | Género                      |
| -------- | ----------- | --------------------------- |
| Mañana   | 7:00        | Actualidad                  |
| Mediodía | 12:00       | Curiosidades / pieza propia |
| Tarde    | 17:00       | Actualidad                  |
| Noche    | 21:00       | Curiosidades / pieza propia |

Cuatro notas: **2 de actualidad y 2 de curiosidades**, exacto y previsible.

- [x] 1. Cuarta franja (21:00) y **género asignado a cada franja** en `franjas.ts`.
- [x] 2. `elegirGenero` obedece a la escaleta; fuera el cálculo por porcentaje.
- [x] 3. **La efeméride deja de mandar**: solo puede ocupar un hueco de curiosidades, y máximo una
      al día. Una efeméride no puede comerse la actualidad.
- [x] 4. **Si el género asignado no tiene material, se cae al otro** y queda anotado. Nunca se
      pierde una nota por no tener candidato del género que tocaba.
- [x] 5. Cuota diaria a 4 y cron con la hora nueva (en `yadominios.json`, que es el que manda).
- [x] 6. El panel muestra la escaleta: qué género toca en cada franja y cuál ya salió.
- [x] 7. Candados: que con la escaleta salgan 2 y 2, que la efeméride no desplace la actualidad, y
      que el fallo aritmético no pueda volver.
- [x] 8. Verificación completa, documentación y publicación.
