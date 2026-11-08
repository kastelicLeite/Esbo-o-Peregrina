UPDATE usuarios SET perfil = 'criador', ativo = 1 WHERE id = 2;
DELETE FROM restricoes_contas WHERE usuario_id = 2;
DELETE FROM sessoes WHERE usuario_id = 2;
DELETE FROM recuperacoes WHERE usuario_id = 2;
