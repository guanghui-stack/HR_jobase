# Hoàn tất Gmail OAuth cho Jobase

Jobase đã có sẵn luồng Gmail OAuth 2.0. Khi kết nối hoàn tất, hệ thống sẽ dùng Gmail đã cấp quyền để gửi hai loại email: thông báo công việc mới theo lĩnh vực người dùng theo dõi và xác nhận khi người dùng thay đổi tuỳ chọn nhận tin.

## Những gì đã được triển khai

| Hạng mục | Trạng thái |
|---|---|
| OAuth client mới của Google Cloud | Đã lưu vào biến môi trường bảo mật và kiểm tra với Google token endpoint |
| Redirect callback của Jobase | `https://3000-iynp5hgwzoy6oaowymgmo-d3ff34ba.us3.manus.computer/api/gmail/oauth/callback` |
| Mã hoá refresh token | Đã triển khai trước khi lưu trong cơ sở dữ liệu |
| Gửi email qua Gmail API | Đã triển khai với scope tối thiểu `gmail.send` |
| Kết nối thực tế với Gmail | Chờ bạn hoàn tất cấp quyền OAuth |

## Các bước cần thực hiện trong Google Cloud

1. Mở **Google Cloud Console** và chọn project chứa OAuth client mới của Jobase.
2. Vào **Google Auth Platform → Branding**. Bảo đảm thông tin ứng dụng, email hỗ trợ và email liên hệ đã được điền.
3. Vào **Audience**. Nếu User type là **External** và Publishing status là **Testing**, thêm chính xác Gmail dùng để gửi thư vào **Test users**.
4. Vào **Data Access**. Thêm hoặc giữ scope `https://www.googleapis.com/auth/gmail.send`.
5. Vào **Clients**, mở OAuth client loại **Web application** của Jobase và bảo đảm **Authorized redirect URI** khớp chính xác với callback ở bảng trên.
6. Xác nhận **Gmail API** đã được bật trong project.

> Trong giai đoạn **Testing**, Google có thể hiển thị cảnh báo ứng dụng chưa xác minh. Điều này là bình thường với OAuth client đang thử nghiệm. Chỉ tiếp tục khi bạn đang dùng Google Cloud project và OAuth client của chính mình.

## Cấp quyền Gmail trong Jobase

1. Đăng nhập Jobase bằng tài khoản quản trị.
2. Mở trang **Quản trị** và nhấn **Kết nối Gmail**.
3. Chọn Gmail được khai báo làm địa chỉ gửi.
4. Nếu Google hiển thị cảnh báo ứng dụng chưa xác minh, chọn **Nâng cao**, sau đó tiếp tục tới Jobase để thử nghiệm.
5. Xem quyền yêu cầu và chọn **Cho phép**. Jobase chỉ yêu cầu quyền gửi email (`gmail.send`).
6. Google sẽ đưa bạn về `/admin?gmail=connected`. Bảng điều khiển sẽ chuyển từ **Kết nối Gmail** sang trạng thái Gmail đã sẵn sàng.

## Nếu Google không hiển thị trang xác nhận

Hãy thử mở lại luồng bằng một phiên riêng tư hoặc một trình duyệt khác sau khi đã đăng nhập Google. Sau đó vào Jobase Admin và nhấn **Kết nối Gmail**. Nếu vẫn gặp vấn đề, giữ nguyên trang lỗi và ghi lại mã lỗi hoặc URL; các thông tin này đủ để chẩn đoán mà không cần chia sẻ mật khẩu.

## Lưu ý khi xuất bản

Khi Jobase được xuất bản với domain chính thức, thêm callback URL của domain đó theo mẫu sau vào OAuth client trong Google Cloud:

`https://<domain-chinh-thuc>/api/gmail/oauth/callback`

Sau đó cập nhật biến môi trường `GMAIL_OAUTH_REDIRECT_URI` bằng đúng URL callback mới và cấp quyền Gmail lại. Google nêu rõ refresh token của app External ở trạng thái Testing có thể hết hạn sau bảy ngày khi dùng Gmail scope, vì vậy hãy hoàn tất quy trình phát hành/xác minh phù hợp trước khi sử dụng rộng rãi. [1] [2]

## References

[1] Google Workspace, [Configure the OAuth consent screen and choose scopes](https://developers.google.com/workspace/guides/configure-oauth-consent).

[2] Google Identity, [Using OAuth 2.0 to Access Google APIs](https://developers.google.com/identity/protocols/oauth2).
