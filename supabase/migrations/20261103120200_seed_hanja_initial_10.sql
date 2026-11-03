-- =============================================================================
-- 하루정리 — 초기 한자 10자 시드 (PRD 0장 4항, 4.5, 4.6)
-- 상태: 2026-11-03 사용자 승인 (천자문 첫 10자). 마이그레이션으로 적용 이력 관리.
-- 후보: 천자문 첫 두 구절 + 다음 구절 첫 두 글자
--   天地玄黃 (천지현황) 宇宙洪荒 (우주홍황) 日月 (일월)
-- 한자당 정확히 1문제 (PRD v1.3 4.6). 재실행해도 중복되지 않도록 ON CONFLICT 사용.
-- supabase db push로 적용. 재실행해도 중복 생성되지 않음.
-- =============================================================================


-- 1) 한자 10자
insert into public.hanja_characters (character, reading, meaning, explanation, difficulty, sort_order) values
  ('天', '천', '하늘', '부수 大. 천자문 첫 구절 天地玄黃(천지현황): 하늘은 검고 땅은 누르다.', 1, 1),
  ('地', '지', '땅', '부수 土. 천자문 天地玄黃(천지현황)의 둘째 글자. 천자문 훈은 전통적으로 ''따 지''.', 1, 2),
  ('玄', '현', '검다, 아득하다', '부수 玄. 天地玄黃에서 하늘의 빛깔(검음)을 나타낸다.', 3, 3),
  ('黃', '황', '누르다(누렇다)', '부수 黃. 天地玄黃에서 땅의 빛깔(누름)을 나타낸다.', 2, 4),
  ('宇', '우', '집, 하늘(공간)', '부수 宀(갓머리). 천자문 둘째 구절 宇宙洪荒(우주홍황): 우주는 넓고 거칠다.', 2, 5),
  ('宙', '주', '집, 하늘(시간)', '부수 宀(갓머리). 宇宙洪荒의 둘째 글자.', 2, 6),
  ('洪', '홍', '넓다, 큰물', '부수 氵(삼수변). 宇宙洪荒에서 우주의 넓음을 나타낸다.', 2, 7),
  ('荒', '황', '거칠다', '부수 艹(초두머리). 宇宙洪荒에서 우주의 거칢을 나타낸다.', 3, 8),
  ('日', '일', '날, 해', '부수 日. 천자문 셋째 구절 日月盈昃(일월영측): 해와 달은 차고 기운다.', 1, 9),
  ('月', '월', '달', '부수 月. 日月盈昃(일월영측)의 둘째 글자.', 1, 10)
on conflict (character) do nothing;

-- 2) 한자어
insert into public.hanja_words (word, reading, meaning) values
  ('天地', '천지', '하늘과 땅. 온 세상'),
  ('地球', '지구', '인류가 살고 있는 행성'),
  ('玄關', '현관', '건물의 출입문이나 그 앞의 공간'),
  ('黃金', '황금', '누런빛의 금. 돈이나 재물을 비유적으로 이르는 말'),
  ('宇宙', '우주', '모든 천체와 공간·시간의 총체'),
  ('洪水', '홍수', '비가 많이 와서 강물 등이 크게 불어 넘치는 일'),
  ('荒野', '황야', '거친 들판'),
  ('日記', '일기', '날마다 겪은 일과 생각을 적은 기록'),
  ('月曜日', '월요일', '한 주의 첫째 날(주 시작을 월요일로 볼 때)')
on conflict on constraint hanja_words_word_reading_meaning_key do nothing;

-- 3) 단어 구성 한자 (초기 10자에 포함된 글자만 연결. 예: 地球의 球는 미적재라 연결하지 않음)
insert into public.hanja_word_characters (word_id, character_id, position)
select w.id, c.id, v.position
  from (values
    ('天地', '天', 1), ('天地', '地', 2),
    ('地球', '地', 1),
    ('玄關', '玄', 1),
    ('黃金', '黃', 1),
    ('宇宙', '宇', 1), ('宇宙', '宙', 2),
    ('洪水', '洪', 1),
    ('荒野', '荒', 1),
    ('日記', '日', 1),
    ('月曜日', '月', 1), ('月曜日', '日', 3)
  ) as v(word, character, position)
  join public.hanja_words w on w.word = v.word
  join public.hanja_characters c on c.character = v.character
on conflict (word_id, position) do nothing;

-- 4) 예문 (단어당 1개)
insert into public.hanja_word_examples (word_id, sentence)
select w.id, v.sentence
  from (values
    ('天地', '밤새 내린 눈이 천지(天地)를 하얗게 덮었다.'),
    ('地球', '지구(地球)는 태양 주위를 돈다.'),
    ('玄關', '집에 들어오면 현관(玄關)에서 신발을 벗는다.'),
    ('黃金', '가을이 되자 황금(黃金)빛 들판이 펼쳐졌다.'),
    ('宇宙', '망원경으로 우주(宇宙)의 별을 관찰했다.'),
    ('洪水', '장마철 큰비로 홍수(洪水)가 났다.'),
    ('荒野', '그는 끝없는 황야(荒野)를 걸었다.'),
    ('日記', '나는 매일 밤 일기(日記)를 쓴다.'),
    ('月曜日', '월요일(月曜日)에는 지난주 오답을 복습한다.')
  ) as v(word, sentence)
  join public.hanja_words w on w.word = v.word
 where not exists (
   select 1 from public.hanja_word_examples e where e.word_id = w.id and e.sentence = v.sentence
 );

-- 5) 퀴즈: 한자당 정확히 1문제
insert into public.quiz_questions (character_id, question_type, question_text, options, correct_option_id, explanation)
select c.id, v.qtype, v.qtext, v.options::jsonb, v.answer, v.expl
  from (values
    ('天', 'meaning', '天의 뜻은 무엇인가요?',
     '[{"id":"A","text":"땅"},{"id":"B","text":"하늘"},{"id":"C","text":"물"},{"id":"D","text":"불"}]',
     'B', '天은 ''하늘 천''입니다. 예: 天地(천지)'),
    ('地', 'reading', '地의 음은 무엇인가요?',
     '[{"id":"A","text":"천"},{"id":"B","text":"토"},{"id":"C","text":"지"},{"id":"D","text":"산"}]',
     'C', '地는 ''땅 지''입니다. 예: 地球(지구)'),
    ('玄', 'meaning', '玄의 뜻은 무엇인가요?',
     '[{"id":"A","text":"누르다"},{"id":"B","text":"검다"},{"id":"C","text":"희다"},{"id":"D","text":"붉다"}]',
     'B', '玄은 ''검을 현''입니다. 天地玄黃: 하늘은 검고 땅은 누르다.'),
    ('黃', 'reading', '黃의 음은 무엇인가요?',
     '[{"id":"A","text":"홍"},{"id":"B","text":"현"},{"id":"C","text":"광"},{"id":"D","text":"황"}]',
     'D', '黃은 ''누를 황''입니다. 예: 黃金(황금)'),
    ('宇', 'reading', '宇의 음은 무엇인가요?',
     '[{"id":"A","text":"우"},{"id":"B","text":"주"},{"id":"C","text":"가"},{"id":"D","text":"택"}]',
     'A', '宇는 ''집 우''입니다. 예: 宇宙(우주)'),
    ('宙', 'reading', '宙의 음은 무엇인가요?',
     '[{"id":"A","text":"우"},{"id":"B","text":"궁"},{"id":"C","text":"주"},{"id":"D","text":"실"}]',
     'C', '宙는 ''집 주''입니다. 예: 宇宙(우주)'),
    ('洪', 'meaning', '洪의 뜻은 무엇인가요?',
     '[{"id":"A","text":"넓다"},{"id":"B","text":"좁다"},{"id":"C","text":"맑다"},{"id":"D","text":"차갑다"}]',
     'A', '洪은 ''넓을 홍''입니다. 예: 洪水(홍수)'),
    ('荒', 'reading', '荒의 음은 무엇인가요?',
     '[{"id":"A","text":"항"},{"id":"B","text":"황"},{"id":"C","text":"광"},{"id":"D","text":"망"}]',
     'B', '荒은 ''거칠 황''입니다. 예: 荒野(황야)'),
    ('日', 'meaning', '日의 뜻은 무엇인가요?',
     '[{"id":"A","text":"달"},{"id":"B","text":"별"},{"id":"C","text":"날, 해"},{"id":"D","text":"물"}]',
     'C', '日은 ''날 일''입니다. 예: 日記(일기)'),
    ('月', 'reading', '月의 음은 무엇인가요?',
     '[{"id":"A","text":"일"},{"id":"B","text":"명"},{"id":"C","text":"월"},{"id":"D","text":"원"}]',
     'C', '月은 ''달 월''입니다. 예: 月曜日(월요일)')
  ) as v(character, qtype, qtext, options, answer, expl)
  join public.hanja_characters c on c.character = v.character
 where not exists (select 1 from public.quiz_questions q where q.character_id = c.id);

