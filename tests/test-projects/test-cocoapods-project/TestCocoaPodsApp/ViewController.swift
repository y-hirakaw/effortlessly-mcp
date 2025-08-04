import UIKit
import Alamofire
import SwiftyJSON
import SnapKit

class ViewController: UIViewController {
    
    private let titleLabel = UILabel()
    private let testButton = UIButton(type: .system)
    
    override func viewDidLoad() {
        super.viewDidLoad()
        setupUI()
        setupConstraints()
    }
    
    private func setupUI() {
        view.backgroundColor = .systemBackground
        
        titleLabel.text = "CocoaPods Test App"
        titleLabel.font = .systemFont(ofSize: 24, weight: .bold)
        titleLabel.textAlignment = .center
        
        testButton.setTitle("Test Network Request", for: .normal)
        testButton.addTarget(self, action: #selector(testNetworkRequest), for: .touchUpInside)
        
        view.addSubview(titleLabel)
        view.addSubview(testButton)
    }
    
    private func setupConstraints() {
        titleLabel.snp.makeConstraints { make in
            make.centerX.equalToSuperview()
            make.top.equalTo(view.safeAreaLayoutGuide).offset(100)
        }
        
        testButton.snp.makeConstraints { make in
            make.centerX.equalToSuperview()
            make.top.equalTo(titleLabel.snp.bottom).offset(50)
        }
    }
    
    @objc private func testNetworkRequest() {
        AF.request("https://jsonplaceholder.typicode.com/posts/1")
            .responseData { response in
                switch response.result {
                case .success(let data):
                    let json = JSON(data)
                    print("Title: \(json["title"].stringValue)")
                case .failure(let error):
                    print("Error: \(error)")
                }
            }
    }
}

class NetworkManager {
    static let shared = NetworkManager()
    
    private init() {}
    
    func fetchUser(id: Int, completion: @escaping (User?) -> Void) {
        AF.request("https://jsonplaceholder.typicode.com/users/\(id)")
            .responseData { response in
                switch response.result {
                case .success(let data):
                    let json = JSON(data)
                    let user = User(
                        id: json["id"].intValue,
                        name: json["name"].stringValue,
                        email: json["email"].stringValue
                    )
                    completion(user)
                case .failure:
                    completion(nil)
                }
            }
    }
}

struct User {
    let id: Int
    let name: String
    let email: String
}