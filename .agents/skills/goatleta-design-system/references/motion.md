# Motion do Go Atleta

1. Comunique mudança de estado e causa/efeito; evite decoração recorrente.
2. Feedback ao toque é imediato. Não atrase nem desabilite uma ação apenas para terminar animação.
3. Preserve interrupção, reversão e gestos; mantenha listas e scouting responsivos.
4. Prefira transform/opacity quando adequados, sem migrar bibliotecas automaticamente.
5. Respeite reduced motion com alternativa funcional e sem perda de informação.
6. Haptic só quando comunica ação relevante; valide em aparelho. Expo Web não prova haptic nativo.
7. Meça latência, layout shift e trabalho da JS thread quando houver alegação de performance. Vídeo é evidência de comportamento, não benchmark por si só.
8. Cubra início → interação → transição → fim; screenshot isolado não prova motion.
9. Movimento esportivo não significa movimento excessivo.
10. A escada de validação define a abrangência. Microajuste não exige automaticamente três viewports ou build completo.
